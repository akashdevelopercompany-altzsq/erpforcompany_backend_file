import { IsNotEmpty, IsNumber, IsString, IsUrl, IsUUID, IsDateString, Min, Max, IsOptional } from 'class-validator';

export class CreatePerformanceReportDto {
    @IsUUID()
    @IsNotEmpty()
    @IsOptional()
    employeeId: string;

    @IsString()
    @IsNotEmpty()
    title: string;

    @IsString()
    @IsNotEmpty()
    projectName: string;

    @IsDateString()
    @IsNotEmpty()
    periodStart: string;

    @IsDateString()
    @IsNotEmpty()
    periodEnd: string;

    @IsUrl()
    @IsNotEmpty()
    @IsOptional()
    fileUrl: string;

    @IsNumber()
    @Min(0)
    @Max(10)
    @IsOptional()
    rating?: number;
}
