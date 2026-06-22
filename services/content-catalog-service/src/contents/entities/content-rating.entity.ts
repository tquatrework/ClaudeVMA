import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Unique,
} from 'typeorm';
import { ContentType } from '../../common/enums/content-type.enum';

@Entity('content_ratings')
@Unique(['contentId', 'contentType', 'authorId'])
export class ContentRating {
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

  @Column({ type: 'int' })
  score: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
