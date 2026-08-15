export class CreateProjectDto {
    title: string;
    description?: string;
    deadline?: Date;
    seniorManagerId?: string; // Optional at creation
}

export class AssignSeniorManagerDto {
    seniorManagerId: string;
}

export class AssignProjectManagerDto {
    projectManagerId: string;
}

export class SelectDepartmentsDto {
    departmentIds: string[];
}

export class CreateReportDto {
    title: string;
    content: string;
    fileUrl: string;
}

export class TerminationRequestDto {
    reason?: string;
    descriptionReport?: string;
    proofUrl?: string;
    discussionReport?: string;
    isOnline?: boolean;
}
