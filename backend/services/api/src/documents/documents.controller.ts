import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { UploadDocumentDto } from "./dto/upload-document.dto";
import { DocumentsService } from "./documents.service";
import { DocumentResponseDto } from "./documents.types";

@Controller("assets/:assetId/documents")
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Post()
  @UseInterceptors(FileInterceptor("file"))
  async uploadDocument(
    @Param("assetId") assetId: string,
    @Body() body: UploadDocumentDto,
    @UploadedFile() file: Express.Multer.File | undefined,
  ): Promise<DocumentResponseDto> {
    if (!file) {
      throw new BadRequestException("file is required");
    }

    return this.documentsService.uploadDocument({
      assetIdOrPublicId: assetId,
      kind: body.kind,
      file,
    });
  }

  @Get()
  async listDocuments(@Param("assetId") assetId: string): Promise<DocumentResponseDto[]> {
    return this.documentsService.listDocuments(assetId);
  }
}
