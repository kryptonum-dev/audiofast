import { Box, Label, Select } from "@sanity/ui";

type AdminFilterSelectProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: [string, string][];
};

export function AdminFilterSelect({
  label,
  onChange,
  options,
  value,
}: AdminFilterSelectProps) {
  return (
    <Box>
      <Label muted size={1}>
        {label}
      </Label>
      <Box marginTop={2}>
        <Select
          aria-label={label}
          fontSize={1}
          onChange={(event) => onChange(event.currentTarget.value)}
          padding={3}
          radius={2}
          value={value}
        >
          {options.map(([optionValue, optionLabel]) => (
            <option key={optionValue} value={optionValue}>
              {optionLabel}
            </option>
          ))}
        </Select>
      </Box>
    </Box>
  );
}
