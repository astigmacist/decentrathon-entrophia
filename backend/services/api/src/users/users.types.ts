export interface UserContextDto {
  wallet: string;
  role: "issuer" | "investor" | "verifier" | "admin" | "unknown";
  displayName: string | null;
}
