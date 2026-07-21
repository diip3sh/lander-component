export const ControlType = {
  String: "string",
  Number: "number",
  Color: "color",
  Enum: "enum",
  Boolean: "boolean",
  Font: "font",
  Array: "array",
  File: "file",
  EventHandler: "eventhandler",
  Transition: "transition",
}

export function addPropertyControls(_component, _controls) {
  // No-op outside Framer. Property controls are applied in the Framer editor.
}
