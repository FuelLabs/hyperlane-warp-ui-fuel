import { IconButton, WarningIcon, XCircleIcon } from '@hyperlane-xyz/widgets';
import { useState } from 'react';

export function FuelInfoBanner() {
  const [shown, setShown] = useState(true);
  return (
    <div
      className={`flex items-center justify-between gap-2 bg-amber-400 pe-0 ps-4 text-sm ${
        shown ? 'max-h-28 py-2' : 'max-h-0'
      } overflow-hidden rounded-2xl transition-all duration-500`}
    >
      <div className="flex items-center gap-2">
        <WarningIcon width={20} height={20} />
        <div className={`items-start justify-between overflow-hidden text-sm`}>
          <p className="mt-1">Tokens on Fuel are synthetics and need to be swapped</p>
          <p>on Mira before transferred using Hyperlane.</p>
        </div>
      </div>
      <IconButton
        title="Hide info"
        className="rounded-full bg-amber-400 px-2.5 py-1 text-center hover:rotate-90"
        onClick={() => setShown(false)}
      >
        <XCircleIcon width={16} height={16} />
      </IconButton>
    </div>
  );
}
