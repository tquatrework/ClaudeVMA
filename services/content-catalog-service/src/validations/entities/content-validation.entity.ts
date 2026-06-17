import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ContentType } from '../../common/enums/content-type.enum';
import { ContentStatus } from '../../common/enums/content-status.enum';

@Entity('content_validations')
export class ContentValidation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  contentId: string;

  @Column({
    type: 'enum',
    enum: ContentType,
  })
  contentType: ContentType;

  @Column()
  validatorId: string;

  @Column()
  validatorRole: string;

  @Column({
    type: 'enum',
    enum: ContentStatus,
  })
  decision: ContentStatus;

  @Column({ type: 'text', nullable: true })
  comment: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
