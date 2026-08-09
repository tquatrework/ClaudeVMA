import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConsentRecord } from './entities/consent-record.entity';
import { ConsentRecordingService } from './consent-recording.service';

/**
 * Propriétaire de l'entité `ConsentRecord` (modules-convention : une entité, un
 * seul module propriétaire). Ne dépend d'aucun autre module métier.
 *
 * Ce découpage existe pour que les deux chemins qui recueillent un consentement
 * — `POST /consents` (ConsentsModule) et les routes de création de compte
 * (AccountsModule) — partagent la MÊME écriture sans créer de cycle de modules :
 * ConsentsModule importe AccountsModule (activation du compte), donc
 * AccountsModule ne peut pas importer ConsentsModule. Les deux importent
 * ConsentRecordingModule, qui n'importe ni l'un ni l'autre.
 */
@Module({
  imports: [TypeOrmModule.forFeature([ConsentRecord])],
  providers: [ConsentRecordingService],
  exports: [ConsentRecordingService],
})
export class ConsentRecordingModule {}
