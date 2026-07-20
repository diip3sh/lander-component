declare module "framer" {
  export const ControlType: {
    String: string
    Number: string
    Color: string
    Enum: string
    Boolean: string
    Font: string
    Array: string
    EventHandler: string
    Transition: string
  }

  export function addPropertyControls(
    component: unknown,
    controls: Record<string, unknown>,
  ): void
}
