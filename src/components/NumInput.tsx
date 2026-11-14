import React, { useEffect, useRef, useState } from 'react';

type Props = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type' | 'min' | 'max'> & {
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
};

// A number box you can actually type in. A plain controlled number input snaps an emptied box back to "0",
// so typing 2 gives "02". This keeps what is typed as text while editing, hands the parent a clamped number,
// selects the old value on focus so typing replaces it, and tidies the text when you leave.
export const NumInput: React.FC<Props> = ({ value, onChange, min = 0, max = Infinity, ...rest }) => {
  const [text, setText] = useState(String(value));
  const editing = useRef(false);

  useEffect(() => {
    // Not typing: follow the value. Typing: only follow when the parent changed it to something other than what is typed (e.g. clamped).
    if (!editing.current || (Number(text) || 0) !== value) setText(String(value));
  }, [value]);

  return (
    <input
      {...rest}
      type="number"
      min={min}
      max={Number.isFinite(max) ? max : undefined}
      value={text}
      onFocus={(e) => { editing.current = true; e.target.select(); rest.onFocus?.(e); }}
      onBlur={(e) => { editing.current = false; setText(String(value)); rest.onBlur?.(e); }}
      onChange={(e) => {
        setText(e.target.value);
        onChange(Math.min(max, Math.max(min, Number(e.target.value) || 0)));
      }}
    />
  );
};
