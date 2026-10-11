import React from 'react';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

/** Small RedCoins brand stamp; fixed colours and vector lettering across themes. */
export function RedCoinsMark({ size = 26 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32" accessible={false}>
      <Rect x="1" y="1" width="30" height="30" rx="9" fill="#A82D36" />
      <Rect x="1.5" y="1.5" width="29" height="29" rx="8.5" fill="none" stroke="#E8BD70" strokeWidth="1" />
      <Circle cx="16" cy="16" r="10.5" fill="#BC3740" stroke="#FFE2A3" strokeWidth="1.4" />
      <Path d="M12.5 22V10.5H17.2C21.4 10.5 21.4 16.7 17.2 16.7H12.5M16.7 16.7L20.4 22" fill="none" stroke="#FFE9BE" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M7 7.5H9M23 24.5H25" stroke="#FFE2A3" strokeWidth="1.2" strokeLinecap="round" />
    </Svg>
  );
}
