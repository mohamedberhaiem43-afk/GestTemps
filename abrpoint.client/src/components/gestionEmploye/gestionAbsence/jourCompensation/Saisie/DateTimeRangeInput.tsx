
interface DateTimeRangeInputProps {
  value: [string, string];
  onChange: (newRange: [string, string]) => void;
  disabled?: boolean;
}

export default function DateTimeRangeInput({
  value,
  onChange,
  disabled = false,
}: DateTimeRangeInputProps) {
  return (
    <div className="flex gap-2 items-center">
      <label>
        Start:
        <input
          type="datetime-local"
          value={value[0]}
          onChange={(e) => onChange([e.target.value, value[1]])}
          disabled={disabled}
          className="border rounded px-2 py-1"
        />
      </label>

      <label>
        End:
        <input
          type="datetime-local"
          value={value[1]}
          onChange={(e) => onChange([value[0], e.target.value])}
          disabled={disabled}
          className="border rounded px-2 py-1"
        />
      </label>
    </div>
  );
}
