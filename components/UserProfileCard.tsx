"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { fetchUserProfile, formatDuration, type UserProfile } from "@/lib/userProfile";
import { VerifiedBadgeIcon, MicIcon, ScreenIcon } from "@/components/icons";
import { BsCoin, BsClock } from "react-icons/bs";
import { hasVerifiedBadge } from "@/lib/entitlements";
import { SocialActions } from "@/components/SocialActions";
import { useAuth } from "@/lib/AuthContext";
import { useSignaling } from "@/lib/useSignaling";
import { signalingClient } from "@/lib/signalingClient";
import { getAccountToken } from "@/lib/accountApi";
import { fetchCosmeticsCatalog, type CosmeticProduct } from "@/lib/cosmetics";
import { prepareAvatarImage, CHAT_IMAGE_ACCEPT, CHAT_IMAGE_MAX_BYTES } from "@/lib/chatImage";
import { MdEdit, MdPhotoCamera, MdDeleteOutline } from "react-icons/md";

// A person's public profile, as a self-contained card.
//
// Lifted out of app/user/[id]/UserProfileClient so the page and the in-room
// dialog (components/UserProfileDialog) show the same thing rather than two
// drifting copies of it — the room used to send people to the page in a new
// tab, which is a lot of ceremony for "who is this?" while you are in a call
// with them. The page still exists and is still the thing a link points at;
// this is just the part that was never page-specific.

const cardClass =
  "rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950";

// One of the three lifetime totals shown below the bio — same card shape for
// call/mic/share time so the three read as one set, not three different
// widgets that happen to sit next to each other.
function StatCard({
  icon,
  label,
  seconds,
}: {
  icon: React.ReactNode;
  label: string;
  seconds: number;
}) {
  return (
    <div className={cardClass}>
      <div className="flex items-center gap-1.5 text-xs font-medium text-zinc-500 dark:text-zinc-400">
        {icon}
        {label}
      </div>
      <p className="mt-1.5 text-lg font-semibold tabular-nums text-zinc-950 dark:text-zinc-50">
        {formatDuration(seconds)}
      </p>
    </div>
  );
}

/**
 * Fetches `id` and renders its profile, including the loading and
 * not-found states.
 *
 * `onNavigate` fires when something inside is about to take the person
 * somewhere else — today only the "they are in a room right now" link. The
 * page has nowhere to go and leaves it out; the dialog uses it to close
 * itself, so a click does not leave a modal hanging over the destination.
 */
export function UserProfileCard({
  id,
  onNavigate,
}: {
  id: string;
  onNavigate?: () => void;
}) {
  const [profile, setProfile] = useState<UserProfile | null | undefined>(undefined);

  // Keeps whatever's already on screen while a new id loads, rather than
  // flashing back to "Carregando..." — the aborted fetch below (on id
  // change/unmount) is what keeps a slow response for a since-abandoned id
  // from landing after the fact.
  useEffect(() => {
    const controller = new AbortController();
    fetchUserProfile(id, controller.signal)
      .then(setProfile)
      .catch((err) => {
        // A superseded request (id changed, or this profile unmounted)
        // aborts on purpose — that's not "not found," it's just stale, and
        // the effect that fired it no longer cares about the answer.
        if (err instanceof DOMException && err.name === "AbortError") return;
        setProfile(null);
      });
    return () => controller.abort();
  }, [id]);

  if (profile === undefined) return <ProfileSkeleton />;
  if (profile === null) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-white p-6 text-center dark:border-zinc-800 dark:bg-zinc-950">
        <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Não foi possível encontrar esse perfil.
        </p>
      </div>
    );
  }
  return <ProfileContent profile={profile} onNavigate={onNavigate} onProfileUpdated={setProfile} />;
}

// The profile's own shape while it is still arriving.
//
// It replaced the line "Carregando perfil...", which was honest and told you
// nothing: the dialog opened at one size showing a sentence, then jumped to
// another size showing a card. Tracing the real layout means the only thing
// that changes when the fetch lands is that the grey blocks become content —
// the box never resizes, which matters far more here than on a page, because
// this one is centred over a room and every resize moves it.
//
// Mirrors ProfileContent below deliberately: same banner height, same rounded
// container, same three-column stat grid. Those values being duplicated is
// the cost, and the thing to check if that layout is ever reworked — a
// skeleton that no longer matches is a shape that jumps, which is worse than
// no skeleton at all.
const SKELETON_BLOCK = "animate-pulse rounded-md bg-zinc-200/80 dark:bg-zinc-800/80";

function ProfileSkeleton() {
  return (
    <div
      className="overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950"
      aria-busy="true"
      aria-label="Carregando perfil"
    >
      <div className={`h-32 w-full rounded-none sm:h-44 ${SKELETON_BLOCK}`} />
      <div className="relative -mt-12 flex items-end justify-between px-5 sm:-mt-16 sm:px-6">
        <div
          className={`h-24 w-24 rounded-2xl border-4 border-white dark:border-zinc-950 sm:h-28 sm:w-28 ${SKELETON_BLOCK}`}
        />
      </div>
      <div className="px-5 pb-5 sm:px-6 sm:pb-6">
        <div className="flex flex-wrap items-end justify-between gap-3 pt-3">
          <div className="min-w-0 flex-1">
            {/* Display name, then @username — the two-line block the real
                header has, at the sizes it actually renders at. */}
            <div className={`h-7 w-44 ${SKELETON_BLOCK}`} />
            <div className={`mt-2 h-4 w-28 ${SKELETON_BLOCK}`} />
          </div>
          <div className={`h-9 w-28 shrink-0 rounded-full ${SKELETON_BLOCK}`} />
        </div>

        {/* The bio: two lines of unequal length, because a paragraph that
            loads as two identical bars reads as a table, not as prose. */}
        <div className={`mt-5 h-4 w-full ${SKELETON_BLOCK}`} />
        <div className={`mt-2 h-4 w-2/3 ${SKELETON_BLOCK}`} />

        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className={`h-[74px] rounded-xl ${SKELETON_BLOCK}`} />
          <div className={`h-[74px] rounded-xl ${SKELETON_BLOCK}`} />
          <div className={`h-[74px] rounded-xl ${SKELETON_BLOCK}`} />
        </div>

        <div className={`mt-5 h-3 w-40 ${SKELETON_BLOCK}`} />
      </div>
    </div>
  );
}

function ProfileContent({
  profile,
  onNavigate,
  onProfileUpdated,
}: {
  profile: UserProfile;
  onNavigate?: () => void;
  onProfileUpdated?: (updated: UserProfile) => void;
}) {
  const { account: authAccount, updateProfile, refresh: refreshAuth } = useAuth();
  const state = useSignaling();
  const { account, live } = profile;
  const isOwner = Boolean(authAccount && authAccount.id === account.id);

  const [isEditing, setIsEditing] = useState(false);
  const [editDisplayName, setEditDisplayName] = useState(account.displayName);
  const [editBio, setEditBio] = useState(account.bio ?? "");
  const [editBgColor, setEditBgColor] = useState<string | null>(account.equippedProfileColor ?? null);
  const [previewAvatar, setPreviewAvatar] = useState<string | null>(account.avatarUrl ?? null);
  const [avatarDataUrl, setAvatarDataUrl] = useState<string | null | undefined>(undefined);
  const [ownedBgColors, setOwnedBgColors] = useState<CosmeticProduct[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync state if profile prop changes
  useEffect(() => {
    setEditDisplayName(account.displayName);
    setEditBio(account.bio ?? "");
    setEditBgColor(account.equippedProfileColor ?? null);
    setPreviewAvatar(account.avatarUrl ?? null);
    setAvatarDataUrl(undefined);
  }, [account]);

  // Load cosmetics when entering edit mode to populate owned background colors
  useEffect(() => {
    if (!isEditing || !isOwner) return;
    let cancelled = false;
    fetchCosmeticsCatalog()
      .then((data) => {
        if (cancelled) return;
        const bgColors = data.catalog.filter(
          (p) => p.type === "profile_color" && data.ownedCosmetics.includes(p.id)
        );
        setOwnedBgColors(bgColors);
      })
      .catch(() => {
        // Silently fail if store catalog cannot be reached
      });
    return () => {
      cancelled = true;
    };
  }, [isEditing, isOwner]);

  async function handleAvatarPicked(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    if (file.size > CHAT_IMAGE_MAX_BYTES) {
      setError(`A imagem deve ter no máximo ${Math.round(CHAT_IMAGE_MAX_BYTES / (1024 * 1024))} MB.`);
      return;
    }
    try {
      const prepared = await prepareAvatarImage(file);
      setPreviewAvatar(prepared.dataUrl);
      setAvatarDataUrl(prepared.dataUrl);
    } catch {
      setError("Não foi possível processar a foto selecionada.");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function handleRemoveAvatar() {
    setPreviewAvatar(null);
    setAvatarDataUrl(null);
  }

  function handleCancel() {
    setIsEditing(false);
    setEditDisplayName(account.displayName);
    setEditBio(account.bio ?? "");
    setEditBgColor(account.equippedProfileColor ?? null);
    setPreviewAvatar(account.avatarUrl ?? null);
    setAvatarDataUrl(undefined);
    setError(null);
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    const trimmedName = editDisplayName.trim();
    if (!trimmedName) {
      setError("O nome de exibição não pode ficar vazio.");
      return;
    }
    setSaving(true);
    setError(null);

    try {
      const updatedAccount = await updateProfile({
        displayName: trimmedName,
        bio: editBio.trim() ? editBio.trim() : null,
        avatar: avatarDataUrl,
        equippedProfileColor: editBgColor,
      });

      onProfileUpdated?.({
        ...profile,
        account: updatedAccount,
      });

      await refreshAuth();

      // If user is currently in a room, announce the new name to participants
      if (state.name && state.name !== trimmedName) {
        signalingClient.register(trimmedName, getAccountToken());
      }

      setIsEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao salvar as alterações.");
    } finally {
      setSaving(false);
    }
  }

  const verified = hasVerifiedBadge(account?.flags);
  const memberSince = new Date(account.createdAt).toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });

  const activeBgColor = isEditing ? editBgColor : account.equippedProfileColor;
  const currentAvatar = isEditing ? previewAvatar : account.avatarUrl;

  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      {/* Banner image or background color purchased with points in cosmetics store */}
      <div
        className="h-32 w-full transition-all duration-300 sm:h-44"
        style={
          account.bannerUrl
            ? {
                backgroundImage: `url(${account.bannerUrl})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }
            : activeBgColor
            ? {
                background: activeBgColor,
              }
            : {
                background: "linear-gradient(135deg, #18181b 0%, #10b981 140%)",
              }
        }
      />

      {/* Avatar overlapping banner and Edit Profile trigger */}
      <div className="relative -mt-12 flex items-end justify-between px-5 sm:-mt-16 sm:px-6">
        <div className="group relative h-24 w-24 shrink-0 overflow-hidden rounded-2xl border-4 border-white bg-zinc-100 shadow-md dark:border-zinc-950 dark:bg-zinc-900 sm:h-28 sm:w-28 flex items-center justify-center">
          {currentAvatar ? (
            <img
              src={currentAvatar}
              alt={account.displayName}
              className="h-full w-full object-cover"
            />
          ) : (
            <span className="flex h-full w-full items-center justify-center bg-gradient-to-br from-emerald-500 to-teal-600 text-3xl font-bold text-white sm:text-4xl">
              {account.displayName.slice(0, 1).toUpperCase()}
            </span>
          )}

          {isEditing && (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              aria-label="Trocar foto de perfil"
              className="absolute inset-0 flex flex-col items-center justify-center bg-black/55 text-white opacity-90 transition-opacity hover:opacity-100"
            >
              <MdPhotoCamera className="h-6 w-6" />
              <span className="mt-1 text-[10px] font-bold uppercase tracking-wider">Alterar</span>
            </button>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept={CHAT_IMAGE_ACCEPT}
          className="hidden"
          onChange={handleAvatarPicked}
        />

        {isOwner && !isEditing && (
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className="flex items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-800 shadow-sm transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            <MdEdit className="h-3.5 w-3.5 text-zinc-500" />
            Editar perfil
          </button>
        )}
      </div>

      <div className="px-5 pb-5 sm:px-6 sm:pb-6">
        {isEditing ? (
          <form onSubmit={handleSave} className="mt-4 flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-zinc-200 pb-3 dark:border-zinc-800">
              <h2 className="text-base font-semibold text-zinc-950 dark:text-zinc-50">
                Editar informações de usuário
              </h2>
              {previewAvatar && (
                <button
                  type="button"
                  onClick={handleRemoveAvatar}
                  className="flex items-center gap-1 text-xs font-medium text-red-600 transition hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                >
                  <MdDeleteOutline className="h-4 w-4" />
                  Remover foto
                </button>
              )}
            </div>

            {/* Display Name */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-xs font-medium text-zinc-700 dark:text-zinc-300">
                <label htmlFor="edit-display-name">Nome de exibição</label>
                <span className="text-zinc-400">{editDisplayName.length}/24</span>
              </div>
              <input
                id="edit-display-name"
                type="text"
                maxLength={24}
                value={editDisplayName}
                onChange={(e) => setEditDisplayName(e.target.value)}
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
                required
              />
            </div>

            {/* Bio */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-xs font-medium text-zinc-700 dark:text-zinc-300">
                <label htmlFor="edit-bio">Descrição</label>
                <span className="text-zinc-400">{editBio.length}/500</span>
              </div>
              <textarea
                id="edit-bio"
                rows={3}
                maxLength={500}
                value={editBio}
                onChange={(e) => setEditBio(e.target.value)}
                placeholder="Escreva algo sobre você..."
                className="w-full resize-none rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
              />
            </div>

            {/* Background color from store */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                Cor do background
              </label>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEditBgColor(null)}
                  className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                    editBgColor === null
                      ? "border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                      : "border-zinc-200 hover:bg-zinc-100 dark:border-zinc-800 dark:hover:bg-zinc-900 text-zinc-700 dark:text-zinc-300"
                  }`}
                >
                  <span className="h-4 w-4 rounded-full bg-gradient-to-br from-zinc-800 to-emerald-500 border border-zinc-300 dark:border-zinc-700" />
                  Padrão
                </button>

                {ownedBgColors.map((colorProduct) => (
                  <button
                    key={colorProduct.id}
                    type="button"
                    onClick={() => setEditBgColor(colorProduct.value)}
                    className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                      editBgColor === colorProduct.value
                        ? "border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                        : "border-zinc-200 hover:bg-zinc-100 dark:border-zinc-800 dark:hover:bg-zinc-900 text-zinc-700 dark:text-zinc-300"
                    }`}
                  >
                    <span
                      className="h-4 w-4 rounded-full border border-black/20"
                      style={{ background: colorProduct.value }}
                    />
                    {colorProduct.label}
                  </button>
                ))}
              </div>

              {ownedBgColors.length === 0 && (
                <p className="mt-1 rounded-lg border border-zinc-200 bg-zinc-50 p-2.5 text-xs text-zinc-500 dark:border-zinc-800/80 dark:bg-zinc-900/50 dark:text-zinc-400">
                  Cores de background poderão ser adquiridas com pontos na loja de cosméticos. Suas cores compradas aparecerão aqui para seleção.
                </p>
              )}
            </div>

            {error && (
              <p className="text-xs font-medium text-red-600 dark:text-red-400">
                {error}
              </p>
            )}

            {/* Actions */}
            <div className="mt-2 flex items-center justify-end gap-2 border-t border-zinc-200 pt-3 dark:border-zinc-800">
              <button
                type="button"
                disabled={saving}
                onClick={handleCancel}
                className="rounded-lg border border-zinc-300 px-3 py-2 text-xs font-medium text-zinc-700 transition hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving || !editDisplayName.trim()}
                className="flex items-center gap-1.5 rounded-lg bg-zinc-950 px-4 py-2 text-xs font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200"
              >
                {saving ? "Salvando foto e perfil..." : "Salvar alterações"}
              </button>
            </div>
          </form>
        ) : (
          <>
            <div className="flex flex-wrap items-end justify-between gap-3 pt-3">
              <div className="min-w-0">
                <h1 className="flex items-center gap-1.5 truncate text-2xl font-semibold text-zinc-950 dark:text-zinc-50">
                  <span style={account.equippedNameColor ? { color: account.equippedNameColor } : undefined}>
                    {account.displayName}
                  </span>
                  {verified && <VerifiedBadgeIcon className="h-6 w-6 shrink-0 text-blue-500" />}
                </h1>
                <p className="truncate text-sm text-zinc-500 dark:text-zinc-400">@{account.username}</p>
              </div>
              <span className="flex shrink-0 items-center gap-1.5 rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-sm font-semibold text-amber-700 dark:text-amber-400">
                <BsCoin className="h-4 w-4 shrink-0" />
                {account.points ?? 0} pontos
              </span>
            </div>

            {live && (
              <Link
                href={`/watch/${live.room}`}
                onClick={onNavigate}
                className="mt-4 flex items-center gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2.5 text-sm font-medium text-emerald-700 transition hover:bg-emerald-500/20 dark:text-emerald-400"
              >
                <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-emerald-500" />
                Está numa sala pública agora — {live.peopleCount}{" "}
                {live.peopleCount === 1 ? "pessoa" : "pessoas"}, entrar em &quot;{live.room}&quot;
              </Link>
            )}

            <p className="mt-4 whitespace-pre-line text-sm text-zinc-700 dark:text-zinc-300">
              {account.bio || "Sem descrição."}
            </p>

            <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <StatCard
                icon={<BsClock className="h-3.5 w-3.5" />}
                label="Tempo em call"
                seconds={account.callSeconds ?? 0}
              />
              <StatCard
                icon={<MicIcon className="h-3.5 w-3.5" />}
                label="Tempo com o mic aberto"
                seconds={account.micSeconds ?? 0}
              />
              <StatCard
                icon={<ScreenIcon className="h-3.5 w-3.5" />}
                label="Tempo compartilhando tela"
                seconds={account.shareSeconds ?? 0}
              />
            </div>

            {/* Adding and blocking live on the profile because that is where you
                land after clicking a name anywhere else — the room's participant
                list, a chat message, the header. See components/SocialActions. */}
            <SocialActions
              userId={account.id}
              displayName={account.displayName}
              className="mt-5"
              // Same callback the profile links use: opening the conversation
              // window is leaving this card, so the dialog holding it closes.
              onLeave={onNavigate}
            />

            <p className="mt-5 text-xs text-zinc-400 dark:text-zinc-600">No GoLive desde {memberSince}.</p>
          </>
        )}
      </div>
    </div>
  );
}
