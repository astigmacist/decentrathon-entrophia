export interface UserContextDto {
  wallet: string;
  role: "issuer" | "investor" | "verifier" | "admin" | "unknown";
  roles: Array<"issuer" | "investor" | "verifier" | "admin">;
  displayName: string | null;
}
