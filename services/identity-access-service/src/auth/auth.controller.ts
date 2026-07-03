import { Controller, Post, Body, Get, UseGuards, Request, Ip, Headers } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { PasswordResetRequestDto } from './dto/password-reset-request.dto';
import { RecoverIdentifierDto } from './dto/recover-identifier.dto';
import { SendVerificationEmailDto } from './dto/send-verification-email.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // ─── Session ───────────────────────────────────────────────────────────────

  @Post('login')
  @ApiOperation({
    summary: 'Connexion',
    description: 'Authentification avec loginIdentifier et mot de passe. Retourne une paire de tokens JWT (access + refresh).',
  })
  @ApiResponse({ status: 200, description: 'Connexion réussie — retourne access_token, refresh_token et infos utilisateur' })
  @ApiResponse({ status: 401, description: 'Identifiants invalides ou compte inactif' })
  login(
    @Body() dto: LoginDto,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent: string,
  ) {
    return this.authService.login(dto, ipAddress, userAgent);
  }

  @Post('logout')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Déconnexion', description: 'Révoque la session courante — le refresh token devient invalide.' })
  @ApiResponse({ status: 200, description: 'Session révoquée' })
  @ApiResponse({ status: 401, description: 'Token manquant ou invalide' })
  async logout(@Request() req) {
    await this.authService.logout(req.user.jti);
    return { message: 'Session revoked' };
  }

  @Post('refresh')
  @ApiOperation({ summary: 'Rafraîchissement de token', description: 'Échange un refresh token valide contre une nouvelle paire de tokens.' })
  @ApiResponse({ status: 200, description: 'Nouvelle paire de tokens émise' })
  @ApiResponse({ status: 401, description: 'Refresh token invalide, expiré ou révoqué' })
  refresh(@Body('refresh_token') refreshToken: string) {
    return this.authService.refresh(refreshToken);
  }

  @Get('me')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Utilisateur courant', description: 'Retourne l\'identité et le statut de validation de l\'utilisateur authentifié.' })
  @ApiResponse({ status: 200, description: 'Identité de l\'utilisateur courant' })
  @ApiResponse({ status: 401, description: 'Token manquant ou invalide' })
  me(@Request() req) {
    const currentUser = req.user;
    return {
      id: currentUser.id,
      loginIdentifier: currentUser.loginIdentifier,
      email: currentUser.email,
      role: currentUser.role,
      validationStatus: currentUser.validationStatus,
      consentSigned: currentUser.consentSigned,
    };
  }

  // ─── Vérification email ────────────────────────────────────────────────────

  @Post('send-verification-email')
  @ApiOperation({
    summary: 'Envoyer un email de vérification',
    description:
      'Envoie un email avec un lien de vérification à l\'adresse fournie. ' +
      'Répond toujours 200 pour ne pas révéler si l\'adresse existe ou si elle est déjà vérifiée.',
  })
  @ApiResponse({ status: 201, description: 'Demande acceptée — un email sera envoyé si le compte existe et n\'est pas encore vérifié' })
  sendVerificationEmail(@Body() dto: SendVerificationEmailDto) {
    return this.authService.sendVerificationEmail(dto.email);
  }

  @Post('verify-email')
  @ApiOperation({
    summary: 'Confirmer la vérification d\'email',
    description: 'Valide le token reçu par email et marque le compte comme vérifié.',
  })
  @ApiResponse({ status: 201, description: 'Email vérifié avec succès' })
  @ApiResponse({ status: 400, description: 'Token invalide ou expiré' })
  verifyEmail(@Body() dto: VerifyEmailDto) {
    return this.authService.verifyEmail(dto.token);
  }

  // ─── Récupération d'identifiant ────────────────────────────────────────────

  @Post('recover-identifier')
  @ApiOperation({
    summary: 'Récupérer son identifiant de connexion',
    description:
      'Envoie par email le ou les identifiant(s) associés à une adresse email. ' +
      'Répond toujours 200 pour ne pas révéler si l\'adresse est enregistrée.',
  })
  @ApiResponse({ status: 201, description: 'Demande acceptée — identifiant(s) envoyé(s) si l\'adresse est connue' })
  recoverIdentifier(@Body() dto: RecoverIdentifierDto, @Ip() ipAddress: string) {
    return this.authService.recoverIdentifier(dto.email, ipAddress);
  }

  // ─── Réinitialisation de mot de passe ─────────────────────────────────────

  @Post('forgot-password')
  @ApiOperation({
    summary: 'Mot de passe oublié (alias)',
    description:
      'Alias de /auth/password-reset/request — initie la réinitialisation via loginIdentifier. ' +
      'Répond toujours 200 pour ne pas révéler si l\'identifiant existe.',
  })
  @ApiResponse({ status: 201, description: 'Demande acceptée — lien de réinitialisation envoyé si l\'identifiant est connu' })
  forgotPassword(@Body() dto: PasswordResetRequestDto, @Ip() ipAddress: string) {
    return this.authService.requestPasswordReset(dto.loginIdentifier, ipAddress);
  }

  @Post('password-reset/request')
  @ApiOperation({
    summary: 'Demander la réinitialisation du mot de passe',
    description:
      'Initie la réinitialisation via loginIdentifier. ' +
      'Répond toujours 200 pour ne pas révéler si l\'identifiant existe. ' +
      'Un lien de reset est envoyé à l\'email associé au compte.',
  })
  @ApiResponse({ status: 201, description: 'Demande acceptée — lien envoyé si l\'identifiant est connu' })
  requestPasswordReset(@Body() dto: PasswordResetRequestDto, @Ip() ipAddress: string) {
    return this.authService.requestPasswordReset(dto.loginIdentifier, ipAddress);
  }

  @Post('reset-password')
  @ApiOperation({
    summary: 'Confirmer la réinitialisation du mot de passe',
    description: 'Valide le token reçu par email et applique le nouveau mot de passe. Révoque toutes les sessions actives.',
  })
  @ApiResponse({ status: 201, description: 'Mot de passe réinitialisé — reconnexion requise' })
  @ApiResponse({ status: 400, description: 'Token invalide ou expiré' })
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto.token, dto.newPassword);
  }
}

// Note: POST /accounts/{id}/access/regenerate est sur AccountsController
// pour garder la gestion du cycle de vie des comptes colocalisée.
