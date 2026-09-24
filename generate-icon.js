const sharp = require('sharp');

const svg = `<svg width="1024" height="1024" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#1E2A3A"/>
      <stop offset="100%" stop-color="#0D0D1A"/>
    </linearGradient>
    <linearGradient id="flameOuter" x1="50%" y1="100%" x2="50%" y2="0%">
      <stop offset="0%" stop-color="#1B5E20"/>
      <stop offset="50%" stop-color="#4CAF50"/>
      <stop offset="100%" stop-color="#A5D6A7"/>
    </linearGradient>
    <linearGradient id="flameInner" x1="50%" y1="100%" x2="50%" y2="0%">
      <stop offset="0%" stop-color="#4CAF50"/>
      <stop offset="100%" stop-color="#E8F5E9"/>
    </linearGradient>
    <filter id="glow">
      <feGaussianBlur stdDeviation="18" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <filter id="softglow">
      <feGaussianBlur stdDeviation="40" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>

  <!-- Background -->
  <rect width="1024" height="1024" rx="210" fill="url(#bg)"/>

  <!-- Ambient glow behind flame -->
  <ellipse cx="512" cy="560" rx="300" ry="320" fill="#4CAF50" opacity="0.08" filter="url(#softglow)"/>

  <!-- Outer flame -->
  <path d="M512 165
           C490 240 420 280 390 370
           C355 475 375 555 400 610
           C388 560 395 510 420 478
           C418 545 440 595 462 635
           C448 598 448 560 465 530
           C465 610 490 668 512 700
           C534 668 559 610 559 530
           C576 560 576 598 562 635
           C584 595 606 545 604 478
           C629 510 636 560 624 610
           C649 555 669 475 634 370
           C604 280 534 240 512 165Z"
        fill="url(#flameOuter)" filter="url(#glow)"/>

  <!-- Inner bright flame -->
  <path d="M512 340
           C500 385 468 415 458 468
           C448 515 460 555 472 585
           C466 558 470 530 484 510
           C483 548 494 578 504 600
           C496 578 496 555 505 538
           C505 578 512 608 512 630
           C512 608 519 578 519 538
           C528 555 528 578 520 600
           C530 578 541 548 540 510
           C554 530 558 558 552 585
           C564 555 576 515 566 468
           C556 415 524 385 512 340Z"
        fill="url(#flameInner)"/>

  <!-- Base glow -->
  <ellipse cx="512" cy="715" rx="155" ry="18" fill="#4CAF50" opacity="0.35"/>

  <!-- Subtle ring decoration -->
  <circle cx="512" cy="512" r="400" fill="none" stroke="#4CAF50" stroke-width="3" opacity="0.12"/>
</svg>`;

sharp(Buffer.from(svg))
  .resize(1024, 1024)
  .png()
  .toFile('./assets/icon.png')
  .then(() => {
    console.log('✅ icon.png generated!');
    return sharp(Buffer.from(svg)).resize(1024, 1024).png().toFile('./assets/adaptive-icon.png');
  })
  .then(() => console.log('✅ adaptive-icon.png generated!'))
  .catch(err => console.error('Error:', err));
