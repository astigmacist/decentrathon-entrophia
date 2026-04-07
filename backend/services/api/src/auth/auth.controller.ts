import { Body, Controller, Get, Headers, Patch, Post, Req } from "@nestjs/common";
import { RequestAuthChallengeDto } from "./dto/request-auth-challenge.dto";
import { VerifyAuthChallengeDto } from "./dto/verify-auth-challenge.dto";
import { UpdateProfileDto } from "./dto/update-profile.dto";
import { AuthChallengeResponseDto, AuthMeDto, AuthSessionContext, AuthSessionResponseDto } from "./auth.types";
import { AuthService } from "./auth.service";

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("challenge")
  async requestChallenge(
    @Body() body: RequestAuthChallengeDto,
    @Headers("user-agent") userAgent: string | undefined,
  ): Promise<AuthChallengeResponseDto> {
    return this.authService.requestChallenge(body.wallet, userAgent);
  }

  @Post("verify")
  async verifyChallenge(
    @Body() body: VerifyAuthChallengeDto,
    @Headers("user-agent") userAgent: string | undefined,
  ): Promise<AuthSessionResponseDto> {
    return this.authService.verifyChallenge(body, userAgent);
  }

  @Get("me")
  async me(
    @Req() req: Request & { auth?: AuthSessionContext },
    @Headers("authorization") authorization: string | undefined,
  ): Promise<AuthMeDto> {
    return this.authService.getMe(req.auth, authorization);
  }

  @Patch("profile")
  async updateProfile(
    @Req() req: Request & { auth?: AuthSessionContext },
    @Headers("authorization") authorization: string | undefined,
    @Body() body: UpdateProfileDto,
  ): Promise<AuthMeDto> {
    return this.authService.updateProfile(req.auth, authorization, body.displayName);
  }

  @Post("logout")
  async logout(
    @Req() req: Request & { auth?: AuthSessionContext },
    @Headers("authorization") authorization: string | undefined,
  ): Promise<{ ok: true }> {
    return this.authService.logout(req.auth, authorization);
  }
}
