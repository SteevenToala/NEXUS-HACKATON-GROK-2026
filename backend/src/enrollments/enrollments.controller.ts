import { Controller, Get, Post, Put, Param, Body, Query } from '@nestjs/common';
import { EnrollmentsService, CreateEnrollmentDto } from './enrollments.service';
import { EnrollmentStatus } from '@prisma/client';

@Controller('api/enrollments')
export class EnrollmentsController {
  constructor(private readonly enrollmentsService: EnrollmentsService) {}

  @Get()
  async getEnrollments(
    @Query('status') status?: EnrollmentStatus,
    @Query('courseId') courseId?: string,
  ) {
    return this.enrollmentsService.getAllEnrollments(status, courseId);
  }

  @Get('stats')
  async getStats() {
    return this.enrollmentsService.getStats();
  }

  @Post()
  async createEnrollment(@Body() dto: CreateEnrollmentDto) {
    return this.enrollmentsService.createEnrollment(dto);
  }

  @Put(':id/status')
  async updateStatus(
    @Param('id') id: string,
    @Body('status') status: EnrollmentStatus,
    @Body('verifiedBy') verifiedBy?: string,
    @Body('notes') notes?: string,
  ) {
    return this.enrollmentsService.updateStatus(id, status, verifiedBy, notes);
  }

  @Post('send-checkout-prompt/:leadId')
  async sendCheckoutPrompt(@Param('leadId') leadId: string) {
    return this.enrollmentsService.sendCheckoutFormPrompt(leadId);
  }
}
