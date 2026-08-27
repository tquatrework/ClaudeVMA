/**
 * Types partagés — Mémo élève (pedagogical-log-service).
 *
 * Contrat aligné sur `docs/routes.md` § « Mémo élève — assaini le 2026-08-27 »
 * (chantier `feat/memo-formules`). Remplace l'ancien modèle plat
 * `{id, title, content, chapterId}`, construit sur des routes qui n'ont
 * jamais existé côté serveur (`POST/GET/PUT/DELETE /memos/:id`).
 *
 * Un chapitre porte directement ses items (structure imbriquée, telle que
 * renvoyée par le serveur) — il n'y a plus de regroupement à faire côté
 * client.
 */

export type MemoItemType = 'text' | 'formula' | 'image'

interface MemoItemBase {
  id: string
  chapterId: string
  order: number
  createdAt: string
  updatedAt: string
}

/** Item texte libre — peut contenir la syntaxe légère (liens, maths inline). */
export interface MemoTextItem extends MemoItemBase {
  type: 'text'
  content: string
}

/** Item formule — `content` porte le LaTeX produit par l'éditeur MathLive. */
export interface MemoFormulaItem extends MemoItemBase {
  type: 'formula'
  content: string
}

/**
 * Item image — `content` porte la légende optionnelle, jamais les octets de
 * l'image elle-même (servis par une route de téléchargement dédiée).
 * `imageStoredFilename` est un identifiant technique, jamais affiché.
 */
export interface MemoImageItem extends MemoItemBase {
  type: 'image'
  content: string | null
  imageOriginalFilename: string
  imageStoredFilename: string
  imageMimeType: string
  imageSizeBytes: number
}

export type MemoItem = MemoTextItem | MemoFormulaItem | MemoImageItem

/**
 * Forme renvoyée par `POST`/`PUT /memos/chapters(/:id)` : le serveur ne
 * renvoie pas systématiquement les items sur ces routes d'écriture — voir
 * `docs/routes.md`, où seules les routes de lecture précisent « avec items ».
 * Le front complète localement (fusion, jamais écrasement — règle du
 * 2026-08-10, point 3bis).
 */
export interface MemoChapterSummary {
  id: string
  studentId: string
  title: string
  order: number
  createdAt: string
  updatedAt: string
}

/** Forme complète, renvoyée par `GET /memos`, `GET /memos/students/:studentId`
 * et `GET /memos/chapters/:chapterId`. */
export interface MemoChapter extends MemoChapterSummary {
  items: MemoItem[]
}

export interface CreateMemoChapterPayload {
  title: string
  order?: number
}

export interface UpdateMemoChapterPayload {
  title?: string
  order?: number
}

export interface CreateMemoTextOrFormulaItemPayload {
  type: 'text' | 'formula'
  content: string
  order?: number
}

export interface UpdateMemoItemPayload {
  content?: string
  order?: number
}
