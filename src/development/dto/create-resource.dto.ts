export class CreateResourceRequestDto {
  title: string;
  description?: string;
  type: 'COURSE' | 'WEBINAR' | 'CERTIFICATION' | 'BOOK' | 'OTHER';
  url?: string;
  cost?: number;
  justification?: string;
}
