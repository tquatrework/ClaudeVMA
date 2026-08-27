/**
 * MemoImageItemView — affiche un item image de mémo (téléchargement
 * authentifié + object URL, voir `useMemoItemImageUrl`).
 *
 * Choix tranché sans instruction ferme : un item image **sans légende**
 * (`content: null`) n'affiche aucun texte de repli du type « Image » — l'image
 * elle-même est déjà l'information, un libellé générique n'ajouterait rien.
 * `alt` reprend la légende si elle existe, sinon un texte neutre pour ne pas
 * laisser un `alt` vide sur une image porteuse de sens (accessibilité).
 */

import React from 'react'
import type { MemoImageItem } from '../../types/memo'
import { useMemoItemImageUrl } from '../../hooks/pedagogical-log/useMemoItemImageUrl'

interface MemoImageItemViewProps {
  item: MemoImageItem
}

export function MemoImageItemView({ item }: MemoImageItemViewProps) {
  const { imageUrl, isLoading, error } = useMemoItemImageUrl(item.chapterId, item.id)

  if (isLoading) {
    return <p className="text-xs text-gray-400">Chargement de l'image…</p>
  }

  if (error || !imageUrl) {
    return <p className="text-xs text-red-500">{error ?? "Cette image n'a pas pu être affichée."}</p>
  }

  return (
    <figure>
      <img
        src={imageUrl}
        alt={item.content ?? 'Image du mémo'}
        className="max-w-full rounded-lg border border-gray-200"
      />
      {item.content && <figcaption className="text-xs text-gray-500 mt-1">{item.content}</figcaption>}
    </figure>
  )
}
