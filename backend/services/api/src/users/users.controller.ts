import { Controller, Get, Param } from "@nestjs/common";
import { UsersService } from "./users.service";
import { UserContextDto } from "./users.types";

@Controller("users")
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get(":wallet")
  async getByWallet(@Param("wallet") wallet: string): Promise<UserContextDto> {
    return this.usersService.resolveByWallet(wallet);
  }
}
