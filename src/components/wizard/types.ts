export type WizardStep = {
  id: string
  title: string
  component: unknown
}
export type WizardState = {
  currentStep: number
  steps: WizardStep[]
  data: Record<string, unknown>
}
