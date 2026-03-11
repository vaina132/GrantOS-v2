import { supabase } from '@/lib/supabase'

const BUCKET = 'avatars'

export const avatarService = {
  /**
   * Upload an avatar image for a person.
   * Stores at: avatars/{orgId}/{personId}.{ext}
   * Returns the public URL.
   */
  async upload(orgId: string, personId: string, file: File): Promise<string> {
    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
    const path = `${orgId}/${personId}.${ext}`

    // Remove any existing avatar first (different extension etc.)
    await this.remove(orgId, personId)

    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(path, file, { upsert: true, contentType: file.type })

    if (error) throw error

    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
    // Append cache-buster so browsers pick up the new image
    return `${data.publicUrl}?t=${Date.now()}`
  },

  /**
   * Remove all avatar files for a person (handles unknown extensions).
   */
  async remove(orgId: string, personId: string): Promise<void> {
    const { data: files } = await supabase.storage
      .from(BUCKET)
      .list(orgId, { search: personId })

    if (files && files.length > 0) {
      const paths = files.map((f) => `${orgId}/${f.name}`)
      await supabase.storage.from(BUCKET).remove(paths)
    }
  },
}
