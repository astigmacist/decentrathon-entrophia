import { MiddlewareConsumer, Module, NestModule, RequestMethod } from "@nestjs/common";
import { APP_INTERCEPTOR } from "@nestjs/core";
import { AuditInterceptor } from "./audit/audit.interceptor";
import { AuditModule } from "./audit/audit.module";
import { AuthModule } from "./auth/auth.module";
import { AppConfigModule } from "./config/config.module";
import { DatabaseModule } from "./database/database.module";
import { AssetsModule } from "./assets/assets.module";
import { ClaimsModule } from "./claims/claims.module";
import { TraceIdMiddleware } from "./common/middleware/trace-id.middleware";
import { ActivityModule } from "./activity/activity.module";
import { DocumentsModule } from "./documents/documents.module";
import { FundingModule } from "./funding/funding.module";
import { HealthModule } from "./health/health.module";
import { ReviewModule } from "./review/review.module";
import { SettlementModule } from "./settlement/settlement.module";
import { SolanaModule } from "./solana/solana.module";
import { TransfersModule } from "./transfers/transfers.module";
import { UsersModule } from "./users/users.module";
import { WhitelistModule } from "./whitelist/whitelist.module";
import { AuthSessionMiddleware } from "./common/middleware/auth-session.middleware";

@Module({
  imports: [
    AppConfigModule,
    DatabaseModule,
    AuditModule,
    AuthModule,
    ActivityModule,
    AssetsModule,
    ClaimsModule,
    HealthModule,
    DocumentsModule,
    ReviewModule,
    FundingModule,
    SolanaModule,
    UsersModule,
    WhitelistModule,
    TransfersModule,
    SettlementModule,
  ],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditInterceptor,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(TraceIdMiddleware, AuthSessionMiddleware)
      .forRoutes({ path: "*path", method: RequestMethod.ALL });
  }
}
