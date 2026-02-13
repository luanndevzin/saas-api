import * as React from "react";
import { Textarea as MantineTextarea } from "@mantine/core";

export type TextareaProps = React.ComponentPropsWithoutRef<typeof MantineTextarea>;

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>((props, ref) => {
  const { className, ...rest } = props;
  return <MantineTextarea ref={ref} radius="md" size="sm" className={className} {...rest} />;
});
Textarea.displayName = "Textarea";

export { Textarea };
