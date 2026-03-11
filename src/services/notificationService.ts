import { supabase } from '@/lib/supabase'
import type { AppNotification, NotificationType } from '@/types'

export const notificationService = {
  /** Fetch notifications for the current user, newest first */
  async list(orgId: string, limit = 50): Promise<AppNotification[]> {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) throw error
    return (data ?? []) as AppNotification[]
  },

  /** Count unread notifications */
  async countUnread(orgId: string): Promise<number> {
    const { count, error } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .eq('is_read', false)

    if (error) throw error
    return count ?? 0
  },

  /** Mark a single notification as read */
  async markRead(id: string): Promise<void> {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', id)

    if (error) throw error
  },

  /** Mark all notifications as read for the current user in this org */
  async markAllRead(orgId: string): Promise<void> {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('org_id', orgId)
      .eq('is_read', false)

    if (error) throw error
  },

  /** Delete a single notification */
  async remove(id: string): Promise<void> {
    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('id', id)

    if (error) throw error
  },

  /** Clear all read notifications */
  async clearRead(orgId: string): Promise<void> {
    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('org_id', orgId)
      .eq('is_read', true)

    if (error) throw error
  },

  /** Create a notification for a specific user */
  async notify(params: {
    orgId: string
    userId: string
    type: NotificationType
    title: string
    message: string
    link?: string
  }): Promise<void> {
    const { error } = await supabase.from('notifications').insert({
      org_id: params.orgId,
      user_id: params.userId,
      type: params.type,
      title: params.title,
      message: params.message,
      link: params.link ?? null,
    })

    if (error) {
      console.error('[GrantOS] Failed to create notification:', error)
    }
  },

  /** Create notifications for multiple users (e.g. all admins) */
  async notifyMany(params: {
    orgId: string
    userIds: string[]
    type: NotificationType
    title: string
    message: string
    link?: string
  }): Promise<void> {
    if (params.userIds.length === 0) return

    const rows = params.userIds.map((userId) => ({
      org_id: params.orgId,
      user_id: userId,
      type: params.type,
      title: params.title,
      message: params.message,
      link: params.link ?? null,
    }))

    const { error } = await supabase.from('notifications').insert(rows)

    if (error) {
      console.error('[GrantOS] Failed to create notifications:', error)
    }
  },

  /** Helper: get all admin/PM user IDs for an org */
  async getAdminUserIds(orgId: string): Promise<string[]> {
    const { data, error } = await supabase
      .from('org_members')
      .select('user_id')
      .eq('org_id', orgId)
      .in('role', ['Admin', 'Project Manager'])

    if (error) return []
    return (data ?? []).map((m) => m.user_id)
  },
}
