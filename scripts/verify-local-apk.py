"""Release artifact checks, including APK v2 signature and content digest.

V2 format: https://source.android.com/docs/security/features/apksigning/v2
This checks this release's RSA/SHA-256 signer; it is not a general APK verifier.
"""
import hashlib
import json
import struct
import sys
import zipfile
from pathlib import Path
from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding


def u32(data, offset=0):
    return struct.unpack_from('<I', data, offset)[0]


class Reader:
    def __init__(self, data):
        self.data, self.offset = data, 0

    def lp(self):
        size = u32(self.data, self.offset)
        self.offset += 4
        end = self.offset + size
        assert end <= len(self.data), 'Truncated length-prefixed field'
        result = self.data[self.offset:end]
        self.offset = end
        return result

    def sequence(self):
        while self.offset < len(self.data):
            yield self.lp()


def manifest_values(data, element="manifest"):
    strings = []
    offset = struct.unpack_from('<H', data, 2)[0]
    while offset < len(data):
        kind, header_size, size = struct.unpack_from('<HHI', data, offset)
        assert size >= header_size and size > 0
        if kind == 1:
            count, _, flags, start, _ = struct.unpack_from('<IIIII', data, offset + 8)
            indices = struct.unpack_from(f'<{count}I', data, offset + header_size)
            for index in indices:
                pos = offset + start + index
                if flags & 0x100:
                    def length8(p):
                        v = data[p]
                        return (((v & 0x7f) << 8) | data[p + 1], p + 2) if v & 0x80 else (v, p + 1)
                    _, pos = length8(pos)
                    length, pos = length8(pos)
                    strings.append(data[pos:pos + length].decode('utf-8'))
                else:
                    length = struct.unpack_from('<H', data, pos)[0]
                    pos += 2
                    if length & 0x8000:
                        length = ((length & 0x7fff) << 16) | struct.unpack_from('<H', data, pos)[0]
                        pos += 2
                    strings.append(data[pos:pos + length * 2].decode('utf-16le'))
        elif kind == 0x102:
            extension = offset + 16
            name = u32(data, extension + 4)
            if strings[name] == element:
                attr_start, attr_size, count = struct.unpack_from('<HHH', data, extension + 8)
                result = {}
                for i in range(count):
                    pos = extension + attr_start + i * attr_size
                    _, name, raw = struct.unpack_from('<III', data, pos)
                    value_type = data[pos + 15]
                    value = u32(data, pos + 16)
                    result[strings[name]] = strings[raw] if raw != 0xffffffff else strings[value] if value_type == 3 else value
                return result
        offset += size
    raise ValueError(f'Manifest element missing: {element}')


def verify(path, version, version_code):
    data = path.read_bytes()
    eocd = data.rfind(b'PK\x05\x06', max(0, len(data) - 65557))
    assert eocd >= 0 and eocd + 22 + struct.unpack_from('<H', data, eocd + 20)[0] == len(data)
    central = u32(data, eocd + 16)
    assert central + u32(data, eocd + 12) == eocd
    assert data[central - 16:central] == b'APK Sig Block 42'
    block_size = struct.unpack_from('<Q', data, central - 24)[0]
    block_start = central - block_size - 8
    assert struct.unpack_from('<Q', data, block_start)[0] == block_size
    pos, v2 = block_start + 8, None
    while pos < central - 24:
        size = struct.unpack_from('<Q', data, pos)[0]
        pos += 8
        assert size >= 4 and pos + size <= central - 24
        if u32(data, pos) == 0x7109871a:
            assert v2 is None, 'Duplicate v2 block'
            v2 = data[pos + 4:pos + size]
        pos += size
    assert v2 is not None, 'APK v2 signature missing'
    signer_hashes = []
    for signer in Reader(Reader(v2).lp()).sequence():
        reader = Reader(signer)
        signed, signatures, public_key = reader.lp(), reader.lp(), reader.lp()
        signature_records = [(u32(s), Reader(s[4:]).lp()) for s in Reader(signatures).sequence()]
        signed_reader = Reader(signed)
        digests, certs = signed_reader.lp(), signed_reader.lp()
        digest_records = [(u32(d), Reader(d[4:]).lp()) for d in Reader(digests).sequence()]
        assert [a for a, _ in signature_records] == [a for a, _ in digest_records]
        algorithm, signature = next((a, s) for a, s in signature_records if a in (0x101, 0x103))
        key = serialization.load_der_public_key(public_key)
        scheme = padding.PKCS1v15() if algorithm == 0x103 else padding.PSS(mgf=padding.MGF1(hashes.SHA256()), salt_length=32)
        key.verify(signature, signed, scheme, hashes.SHA256())
        certificate = Reader(certs).lp()
        cert = x509.load_der_x509_certificate(certificate)
        assert cert.public_key().public_bytes(serialization.Encoding.DER, serialization.PublicFormat.SubjectPublicKeyInfo) == public_key
        signer_hashes.append(hashlib.sha256(certificate).hexdigest())
        patched_eocd = bytearray(data[eocd:])
        struct.pack_into('<I', patched_eocd, 16, block_start)
        chunks = []
        for section in (data[:block_start], data[central:eocd], patched_eocd):
            for offset in range(0, len(section), 1048576):
                chunk = section[offset:offset + 1048576]
                chunks.append(hashlib.sha256(b'\xa5' + struct.pack('<I', len(chunk)) + chunk).digest())
        digest = hashlib.sha256(b'\x5a' + struct.pack('<I', len(chunks)) + b''.join(chunks)).digest()
        assert dict(digest_records)[algorithm] == digest, 'Signed APK content digest mismatch'
    assert signer_hashes == ['62a8aa1dd325bbe4b76855f4f3cc239950c4133b76ff904244cad6c78695161c'], 'Signer changed'
    with zipfile.ZipFile(path) as archive:
        assert archive.testzip() is None, 'ZIP CRC failed'
        abis = sorted({n.split('/')[1] for n in archive.namelist() if n.startswith('lib/') and n.endswith('.so')})
        assert abis == ['arm64-v8a'], abis
        manifest_bytes = archive.read('AndroidManifest.xml')
        manifest = manifest_values(manifest_bytes)
        application = manifest_values(manifest_bytes, 'application')
        assert not application.get('debuggable', 0), 'APK is debuggable'
        assert archive.getinfo('assets/index.android.bundle').file_size > 100000, 'Standalone JS bundle missing'
        assert manifest['package'] == 'com.calorietracker.app', manifest
        assert manifest['versionName'] == version, manifest
        assert manifest['versionCode'] == int(version_code), manifest
    return {'file': str(path), 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest(), 'abis': abis, 'package': manifest['package'], 'version': version, 'versionCode': int(version_code), 'signerSha256': signer_hashes[0], 'v2SignatureAndContentDigest': 'verified', 'zipCrc': 'verified', 'debuggable': False, 'embeddedJsBundle': 'verified'}


if __name__ == '__main__':
    print(json.dumps(verify(Path(sys.argv[1]), sys.argv[2], sys.argv[3]), indent=2))
