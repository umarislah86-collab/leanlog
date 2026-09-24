import { useEffect, useState } from 'react';
import * as Application from 'expo-application';
import {
  fsGetDeviceLicense, fsSetDeviceTrialStart,
  fsSetDevicePaid, fsGetLicense,
} from '../firebase';

export type TrialStatus = 'loading' | 'active' | 'expired' | 'paid';

const TRIAL_DAYS = 3;
const FAR_FUTURE = '2099-01-01T00:00:00.000Z'; // for backward compat with old paid:true docs

const isPaidByDate = (paidUntil?: string) =>
  !!paidUntil && new Date(paidUntil) > new Date();

export function useTrial(enabled: boolean) {
  const [status, setStatus] = useState<TrialStatus>('loading');
  const [daysLeft, setDaysLeft] = useState(TRIAL_DAYS);

  useEffect(() => {
    if (!enabled) return;
    check();
  }, [enabled]);

  const check = async () => {
    try {
      const androidId = Application.getAndroidId();
      if (!androidId) { setStatus('active'); return; }

      let license = await fsGetDeviceLicense(androidId);

      if (!license?.trialStartDate) {
        const now = new Date().toISOString();
        await fsSetDeviceTrialStart(androidId, now);
        license = { trialStartDate: now, paid: false };
      }

      // Support both old paid:true boolean and new paidUntil date string
      const devicePaid = license.paid === true || isPaidByDate(license.paidUntil);
      if (devicePaid) {
        const paidUntil = license.paidUntil ?? FAR_FUTURE;
        setStatus('paid');
        return;
      }

      const start = new Date(license.trialStartDate!);
      const diffDays = Math.floor((Date.now() - start.getTime()) / 86400000);
      const left = Math.max(0, TRIAL_DAYS - diffDays);
      setDaysLeft(left);

      if (diffDays >= TRIAL_DAYS) {
        // Trial expired — check UID license as fallback (user may have changed phone)
        const uidLicense = await fsGetLicense();
        const uidPaid = uidLicense?.paid === true || isPaidByDate(uidLicense?.paidUntil);
        if (uidPaid) {
          const paidUntil = uidLicense?.paidUntil ?? FAR_FUTURE;
          fsSetDevicePaid(androidId, paidUntil); // sync to new device doc
          setStatus('paid');
          return;
        }
        setStatus('expired');
      } else {
        setStatus('active');
      }
    } catch {
      setStatus('active');
    }
  };

  return { status, daysLeft, recheck: check };
}
