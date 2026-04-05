import { Controller, Get, Param, Query } from "@nestjs/common";
import { ActivityService } from "./activity.service";
import { ListActivityDto } from "./dto/list-activity.dto";
import { ActivityItemDto } from "./activity.types";

@Controller("activity")
export class ActivityController {
  constructor(private readonly activityService: ActivityService) {}

  @Get(":assetId")
  async list(
    @Param("assetId") assetId: string,
    @Query() query: ListActivityDto,
  ): Promise<ActivityItemDto[]> {
    return this.activityService.listByAssetId(assetId, query);
  }
}
