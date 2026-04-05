import { Body, Controller, Post } from "@nestjs/common";
import { PrepareTransferDto } from "./dto/prepare-transfer.dto";
import { ValidateTransferDto } from "./dto/validate-transfer.dto";
import { TransfersService } from "./transfers.service";
import { TransferPrepareResponseDto, TransferValidationResponseDto } from "./transfers.types";

@Controller("transfers")
export class TransfersController {
  constructor(private readonly transfersService: TransfersService) {}

  @Post("validate")
  async validate(@Body() body: ValidateTransferDto): Promise<TransferValidationResponseDto> {
    return this.transfersService.validate(body);
  }

  @Post("prepare")
  async prepare(@Body() body: PrepareTransferDto): Promise<TransferPrepareResponseDto> {
    return this.transfersService.prepare(body);
  }
}
