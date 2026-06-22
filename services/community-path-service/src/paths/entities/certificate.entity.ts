import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity('certificates')
export class Certificate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  enrollmentId: string;

  @Column()
  studentId: string;

  @Column()
  learningPathId: string;

  @Column()
  learningPathTitle: string;

  @CreateDateColumn()
  issuedAt: Date;
}
