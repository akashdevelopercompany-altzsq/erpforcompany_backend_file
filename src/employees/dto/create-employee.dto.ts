import { IsEnum, IsNotEmpty, IsOptional, IsString, IsNumber, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';
import { Gender } from '@prisma/client';

export class CreateEmployeeDto {
    @IsString()
    @IsNotEmpty()
    firstName: string;

    @IsString()
    @IsNotEmpty()
    lastName: string;

    @IsEnum(Gender)
    @IsNotEmpty()
    gender: Gender;

    @IsString()
    @IsOptional()
    phone?: string;

    @IsString()
    @IsOptional()
    address?: string;

    @IsString()
    @IsOptional()
    jobTitle?: string;

    @IsDateString()
    @IsOptional()
    joinDate?: string;

    @Type(() => Number)
    @IsNumber()
    @IsOptional()
    salary?: number;

    @IsDateString()
    @IsOptional()
    dob?: string;

    @IsString()
    @IsOptional()
    bloodGroup?: string;

    @IsString()
    @IsOptional()
    managerId?: string;

    // Note: userId is usually linked during creation if creating a standalone employee record, 
    // but in this system Employee is created with User. 
    // This DTO might be used if we separate them, but for now let's assume this is for updating or specific creation flows.
    // Actually, the requirement says "POST /employees" by Admin. This usually implies creating a User+Employee or just Employee profile?
    // The schema has 1:1 User-Employee. So creating an Employee usually means creating a User too.
    // We already have `registerEmployee` in Auth. 
    // If `POST /employees` is required, it should probably wrap `registerEmployee` logic or be for adding details.
    // Let's assume `POST /employees` is an alias or administrative way to create employees (User+Employee).
    // I will add email/password here to make it a full creation DTO if needed, or keep it simple.
    // Given the prompt "POST /employees (ADMIN, SUPER_ADMIN)", it likely duplicates Register Employee functionality but under Employees resource.
    // I'll add email/password to make it functional for creating a new employee user.

    @IsString()
    @IsNotEmpty()
    email: string;

    @IsString()
    @IsNotEmpty()
    password: string;
}
