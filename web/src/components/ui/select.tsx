import * as React from "react";
import { NativeSelect } from "@mantine/core";

export type SelectProps = React.ComponentPropsWithoutRef<typeof NativeSelect>;

const Select = React.forwardRef<HTMLSelectElement, SelectProps>((props, ref) => {
  const { className, children, ...rest } = props;
  return (
    <NativeSelect ref={ref} radius="md" size="sm" className={className} {...rest}>
      {children}
    </NativeSelect>
  );
});
Select.displayName = "Select";

export { Select };
