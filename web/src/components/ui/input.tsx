import * as React from "react";
import { TextInput } from "@mantine/core";

export type InputProps = React.ComponentPropsWithoutRef<typeof TextInput>;

const Input = React.forwardRef<HTMLInputElement, InputProps>((props, ref) => {
  const { className, ...rest } = props;
  return (
    <TextInput
      ref={ref}
      radius="md"
      size="sm"
      className={className}
      {...rest}
    />
  );
});
Input.displayName = "Input";

export { Input };
