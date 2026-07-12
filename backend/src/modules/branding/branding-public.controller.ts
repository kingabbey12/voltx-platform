import { Controller, Get, Param } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { BrandingPublicService } from './branding-public.service';
import { PublicBrandingResponseDto } from './dto/branding.dto';

@ApiTags('Enterprise White-label — Public')
@Controller('branding/public')
export class BrandingPublicController {
  constructor(private readonly brandingPublicService: BrandingPublicService) {}

  @Get(':orgSlugOrDomain')
  @ApiOperation({
    summary:
      'Unauthenticated: fetch the public branding (logo, colors, login copy) for an organization slug or a verified custom domain — used to render a white-labeled login screen',
  })
  async getPublicBranding(
    @Param('orgSlugOrDomain') orgSlugOrDomain: string,
  ): Promise<PublicBrandingResponseDto> {
    return this.brandingPublicService.getPublicBranding(orgSlugOrDomain);
  }
}
