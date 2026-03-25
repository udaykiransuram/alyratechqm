export function isMockedE2ETestMode() {
  return process.env.NEXT_PUBLIC_E2E_MOCK_MODE === "1";
}
