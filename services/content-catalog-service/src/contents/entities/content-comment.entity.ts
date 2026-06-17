import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ContentType } from '../../common/enums/content-type.enum';

@Entity('content_comments')
export class ContentComment {
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
  authorId: string;

  @Column()
  authorRole: string;

  @Column({ type: 'text' })
  text: string;

  @Column({ default: false })
  isOwnerHint: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
