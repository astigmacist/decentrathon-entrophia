import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

@Injectable()
export class StorageService {
  private readonly client?: S3Client;
  private readonly provider: "memory" | "minio" | "s3" | "pinata";
  private readonly bucket: string;
  private readonly endpoint?: string;
  private readonly forcePathStyle: boolean;

  constructor(private readonly configService: ConfigService) {
    const provider = this.configService.get<string>("STORAGE_PROVIDER", "minio");
    this.provider =
      provider === "memory" || provider === "minio" || provider === "s3" || provider === "pinata"
        ? provider
        : "minio";

    const configuredEndpoint = this.getEndpointFromEnv();
    const accessKey = this.configService.get<string>("MINIO_ACCESS_KEY");
    const secretKey = this.configService.get<string>("MINIO_SECRET_KEY");
    const bucket =
      this.configService.get<string>("MINIO_BUCKET") ??
      (this.provider === "memory" ? "local-documents" : undefined);

    if (!bucket) {
      throw new Error("MINIO_BUCKET is required for storage operations.");
    }

    this.bucket = bucket;
    this.endpoint = configuredEndpoint;
    this.forcePathStyle = this.provider === "minio";

    if (this.provider !== "memory") {
      this.client = new S3Client({
        region: this.configService.get<string>("AWS_REGION", "us-east-1"),
        endpoint: configuredEndpoint,
        forcePathStyle: this.forcePathStyle,
        credentials:
          accessKey && secretKey
            ? {
                accessKeyId: accessKey,
                secretAccessKey: secretKey,
              }
            : undefined,
      });
    }
  }

  async putObject(params: {
    key: string;
    body: Buffer;
    contentType: string;
  }): Promise<{ fileUri: string }> {
    if (this.provider !== "memory") {
      await this.client?.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: params.key,
          Body: params.body,
          ContentType: params.contentType,
        }),
      );
    }

    return {
      fileUri: this.buildFileUri(params.key),
    };
  }

  private getEndpointFromEnv(): string | undefined {
    const endpoint = this.configService.get<string>("MINIO_ENDPOINT");
    if (!endpoint) {
      return undefined;
    }

    if (endpoint.startsWith("http://") || endpoint.startsWith("https://")) {
      return endpoint.replace(/\/+$/, "");
    }

    const useSsl = this.configService.get<boolean>("MINIO_USE_SSL", false);
    const port = this.configService.get<number>("MINIO_PORT");
    const protocol = useSsl ? "https" : "http";
    const portPart = port ? `:${port}` : "";

    return `${protocol}://${endpoint}${portPart}`;
  }

  private buildFileUri(key: string): string {
    const encodedKey = key
      .split("/")
      .map((segment) => encodeURIComponent(segment))
      .join("/");

    if (this.provider === "memory") {
      return `memory://${this.bucket}/${encodedKey}`;
    }

    if (!this.endpoint) {
      return `s3://${this.bucket}/${encodedKey}`;
    }

    return `${this.endpoint}/${this.bucket}/${encodedKey}`;
  }
}
