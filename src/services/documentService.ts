import { supabase } from '@/lib/supabase'

export interface ProjectDocument {
  id: string
  org_id: string
  project_id: string
  title: string | null
  name: string | null
  file_name: string | null
  file_url: string | null
  file_size_bytes: number | null
  uploaded_by: string | null
  uploaded_at: string | null
  tags: string[]
  created_at: string
}

export const documentService = {
  async listByProject(projectId: string): Promise<ProjectDocument[]> {
    const { data, error } = await supabase
      .from('project_documents')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })

    if (error) throw error
    return (data ?? []) as ProjectDocument[]
  },

  async upload(
    orgId: string,
    projectId: string,
    file: File,
    title: string,
    userId: string,
  ): Promise<ProjectDocument> {
    // Sanitise the file name so it can't break out of the org/project prefix
    // via "../" or contain separators / control characters. Keep only
    // letters, digits, dot, dash, underscore; everything else → underscore.
    // Cap at 120 chars to avoid hitting Supabase Storage path limits.
    const safeName = (file.name || 'upload')
      .replace(/[^a-zA-Z0-9._-]+/g, '_')
      .replace(/_{2,}/g, '_')
      .replace(/^\.+/, '')
      .slice(0, 120) || 'upload'
    const filePath = `${orgId}/${projectId}/${Date.now()}_${safeName}`

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from('project-documents')
      .upload(filePath, file)

    if (uploadError) throw uploadError

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('project-documents')
      .getPublicUrl(filePath)

    // Insert record
    const { data, error } = await supabase
      .from('project_documents')
      .insert({
        org_id: orgId,
        project_id: projectId,
        title,
        name: file.name,
        file_name: file.name,
        file_url: urlData.publicUrl,
        file_size_bytes: file.size,
        uploaded_by: userId,
        uploaded_at: new Date().toISOString(),
        tags: [],
      })
      .select()
      .single()

    if (error) throw error
    return data as ProjectDocument
  },

  async remove(id: string, fileUrl: string | null): Promise<void> {
    // Delete from storage if URL exists
    if (fileUrl) {
      const path = fileUrl.split('/project-documents/')[1]
      if (path) {
        await supabase.storage.from('project-documents').remove([path])
      }
    }

    const { error } = await supabase
      .from('project_documents')
      .delete()
      .eq('id', id)

    if (error) throw error
  },
}
