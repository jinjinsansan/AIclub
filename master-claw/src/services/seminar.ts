// セミナー管理サービス
import { config } from '@/config'
import { logger, loggerHelpers, PerformanceLogger } from '@/utils/logger'
import type { Member, SeminarSchedule, SeminarAttendance } from '@/types'
import { DatabaseService } from './database'
import { NotificationService } from './notification'
import { LineNotificationService } from './line'
import axios from 'axios'

interface SeminarCreateData {
  title: string
  description?: string
  scheduled_at: string
  duration_minutes: number
  max_attendees?: number
  zoom_meeting_id?: string
  access_level: 'all' | 'active' | 'premium' | 'master'
  presenter_name: string
  materials_url?: string
}

interface ZoomMeetingConfig {
  topic: string
  type: 2 // Scheduled meeting
  start_time: string
  duration: number
  timezone: string
  password?: string
  agenda?: string
  settings: {
    host_video: boolean
    participant_video: boolean
    join_before_host: boolean
    mute_upon_entry: boolean
    waiting_room: boolean
    auto_recording: 'local' | 'cloud' | 'none'
  }
}

export class SeminarManagementService {
  private db: DatabaseService
  private notification: NotificationService
  private lineNotification: LineNotificationService
  private zoomApiKey?: string
  private zoomApiSecret?: string

  constructor(
    db: DatabaseService,
    notification: NotificationService,
    lineNotification: LineNotificationService
  ) {
    this.db = db
    this.notification = notification
    this.lineNotification = lineNotification
    this.zoomApiKey = config.zoom?.apiKey
    this.zoomApiSecret = config.zoom?.apiSecret
  }

  // セミナーの作成
  async createSeminar(seminarData: SeminarCreateData): Promise<{
    success: boolean
    seminar_id?: string
    zoom_url?: string
    error?: string
  }> {
    const perf = new PerformanceLogger('seminar-creation')

    try {
      loggerHelpers.system.processing('Creating new seminar', {
        title: seminarData.title,
        scheduled_at: seminarData.scheduled_at,
        access_level: seminarData.access_level
      })

      // 1. Zoom会議の作成
      let zoomMeetingInfo = null
      if (this.zoomApiKey && this.zoomApiSecret) {
        zoomMeetingInfo = await this.createZoomMeeting({
          topic: seminarData.title,
          type: 2,
          start_time: seminarData.scheduled_at,
          duration: seminarData.duration_minutes,
          timezone: 'Asia/Tokyo',
          agenda: seminarData.description,
          settings: {
            host_video: true,
            participant_video: true,
            join_before_host: true,
            mute_upon_entry: true,
            waiting_room: true,
            auto_recording: 'cloud'
          }
        })

        if (!zoomMeetingInfo.success) {
          logger.warn('Zoom meeting creation failed, continuing without Zoom', {
            error: zoomMeetingInfo.error
          })
        }
      }

      // 2. データベースにセミナーを登録
      const seminarRecord = {
        id: `seminar_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        title: seminarData.title,
        description: seminarData.description || '',
        scheduled_at: seminarData.scheduled_at,
        duration_minutes: seminarData.duration_minutes,
        max_attendees: seminarData.max_attendees || 100,
        access_level: seminarData.access_level,
        presenter_name: seminarData.presenter_name,
        materials_url: seminarData.materials_url,
        zoom_meeting_id: zoomMeetingInfo?.meeting_id,
        zoom_url: zoomMeetingInfo?.join_url,
        zoom_password: zoomMeetingInfo?.password,
        status: 'scheduled' as const,
        registered_count: 0,
        attendance_count: 0,
        recording_url: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }

      // TODO: データベースへの保存
      // const { error: dbError } = await this.db.createSeminar(seminarRecord)
      // if (dbError) throw new Error(`Database error: ${dbError.message}`)

      // 3. 参加対象メンバーへの通知準備
      const eligibleMembers = await this.getEligibleMembers(seminarData.access_level)
      
      // 4. LINE通知の送信（セミナー開始1時間前に予約）
      const notificationTime = new Date(new Date(seminarData.scheduled_at).getTime() - 60 * 60 * 1000)
      await this.scheduleNotification(seminarRecord, notificationTime)

      loggerHelpers.system.completed('Seminar created successfully', {
        seminar_id: seminarRecord.id,
        title: seminarData.title,
        scheduled_at: seminarData.scheduled_at,
        eligible_members: eligibleMembers.length,
        zoom_enabled: !!zoomMeetingInfo?.success
      })

      perf.finish({
        seminar_id: seminarRecord.id,
        eligible_members: eligibleMembers.length
      })

      return {
        success: true,
        seminar_id: seminarRecord.id,
        zoom_url: zoomMeetingInfo?.join_url
      }

    } catch (error: any) {
      perf.finishWithError(error)
      logger.error('Failed to create seminar', {
        title: seminarData.title,
        error: error.message
      })

      return {
        success: false,
        error: error.message
      }
    }
  }

  // 出席管理
  async trackAttendance(
    seminarId: string,
    attendees: Array<{ member_id: string; joined_at: string; left_at?: string }>
  ): Promise<boolean> {
    const perf = new PerformanceLogger('attendance-tracking')

    try {
      loggerHelpers.system.processing('Tracking seminar attendance', {
        seminar_id: seminarId,
        attendee_count: attendees.length
      })

      // 1. 出席記録の保存
      for (const attendee of attendees) {
        const attendanceRecord = {
          id: `attendance_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          seminar_id: seminarId,
          member_id: attendee.member_id,
          joined_at: attendee.joined_at,
          left_at: attendee.left_at,
          duration_minutes: attendee.left_at ? 
            Math.floor((new Date(attendee.left_at).getTime() - new Date(attendee.joined_at).getTime()) / (1000 * 60)) : 
            null,
          created_at: new Date().toISOString()
        }

        // TODO: データベースへの保存
        // await this.db.createAttendanceRecord(attendanceRecord)
      }

      // 2. セミナー統計の更新
      await this.updateSeminarStats(seminarId, attendees.length)

      // 3. 出席証明書の発行（希望者のみ）
      const completedAttendees = attendees.filter(a => 
        a.left_at && 
        (new Date(a.left_at).getTime() - new Date(a.joined_at).getTime()) >= (45 * 60 * 1000) // 45分以上参加
      )

      for (const attendee of completedAttendees) {
        await this.issueCertificate(seminarId, attendee.member_id)
      }

      loggerHelpers.system.completed('Attendance tracking completed', {
        seminar_id: seminarId,
        total_attendees: attendees.length,
        completed_attendees: completedAttendees.length
      })

      perf.finish({
        attendee_count: attendees.length,
        completed_count: completedAttendees.length
      })

      return true

    } catch (error: any) {
      perf.finishWithError(error)
      logger.error('Failed to track attendance', {
        seminar_id: seminarId,
        error: error.message
      })
      return false
    }
  }

  // セミナー録画アーカイブの生成
  async generateArchive(
    seminarId: string,
    recordingUrl: string,
    thumbnailUrl?: string
  ): Promise<{
    success: boolean
    archive_id?: string
    error?: string
  }> {
    const perf = new PerformanceLogger('archive-generation')

    try {
      loggerHelpers.system.processing('Generating seminar archive', {
        seminar_id: seminarId,
        recording_url: recordingUrl ? 'present' : 'none'
      })

      // 1. アーカイブレコードの作成
      const archiveRecord = {
        id: `archive_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        seminar_id: seminarId,
        recording_url: recordingUrl,
        thumbnail_url: thumbnailUrl,
        file_size_bytes: null,
        duration_seconds: null,
        access_level: 'active', // セミナーと同じアクセス制御
        is_public: false,
        download_count: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }

      // TODO: データベースへの保存
      // await this.db.createArchive(archiveRecord)

      // 2. セミナーステータスの更新
      // await this.db.updateSeminarStatus(seminarId, 'completed', { recording_url: recordingUrl })

      // 3. アーカイブ公開通知（アクティブメンバー向け）
      const eligibleMembers = await this.getEligibleMembers('active')
      await this.notification.sendArchiveAvailableNotification({
        seminar_id: seminarId,
        archive_id: archiveRecord.id,
        member_ids: eligibleMembers.map(m => m.member_id)
      })

      loggerHelpers.system.completed('Archive generated successfully', {
        seminar_id: seminarId,
        archive_id: archiveRecord.id,
        eligible_members: eligibleMembers.length
      })

      perf.finish({
        archive_id: archiveRecord.id,
        eligible_members: eligibleMembers.length
      })

      return {
        success: true,
        archive_id: archiveRecord.id
      }

    } catch (error: any) {
      perf.finishWithError(error)
      logger.error('Failed to generate archive', {
        seminar_id: seminarId,
        error: error.message
      })

      return {
        success: false,
        error: error.message
      }
    }
  }

  // 今後のセミナー一覧取得
  async getUpcomingSeminars(limit: number = 10): Promise<SeminarSchedule[]> {
    try {
      const now = new Date().toISOString()
      
      // TODO: データベースから取得
      // const { data, error } = await this.db.getUpcomingSeminars(now, limit)
      // if (error) throw error

      // モックデータを返す
      const mockSeminars: SeminarSchedule[] = [
        {
          id: 'seminar_1',
          title: 'OPEN CLAW 基礎講座：トレードAI入門',
          description: 'AI自動トレードの基本概念から実践的な設定方法まで',
          scheduled_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 明日
          duration_minutes: 90,
          presenter_name: '田中 太郎',
          zoom_url: 'https://zoom.us/j/example1',
          access_level: 'active',
          status: 'scheduled',
          registered_count: 23,
          max_attendees: 100
        },
        {
          id: 'seminar_2', 
          title: 'MINARA AI連携セミナー：高度な戦略設定',
          description: '自然言語を使った複雑なトレード戦略の構築方法',
          scheduled_at: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(), // 3日後
          duration_minutes: 120,
          presenter_name: '佐藤 花子',
          zoom_url: 'https://zoom.us/j/example2',
          access_level: 'active',
          status: 'scheduled',
          registered_count: 15,
          max_attendees: 50
        }
      ]

      return mockSeminars

    } catch (error: any) {
      logger.error('Failed to get upcoming seminars', { error: error.message })
      return []
    }
  }

  // セミナー統計の取得
  async getSeminarStats(): Promise<{
    total_seminars: number
    upcoming_seminars: number
    completed_seminars: number
    total_attendees: number
    average_attendance_rate: number
    this_month_seminars: number
  }> {
    try {
      // TODO: データベースから実際の統計を取得
      // 現在はモック値を返す
      return {
        total_seminars: 12,
        upcoming_seminars: 2,
        completed_seminars: 10,
        total_attendees: 187,
        average_attendance_rate: 78.5,
        this_month_seminars: 4
      }
    } catch (error: any) {
      logger.error('Failed to get seminar stats', { error: error.message })
      return {
        total_seminars: 0,
        upcoming_seminars: 0,
        completed_seminars: 0,
        total_attendees: 0,
        average_attendance_rate: 0,
        this_month_seminars: 0
      }
    }
  }

  // プライベートメソッド

  // Zoom会議の作成
  private async createZoomMeeting(config: ZoomMeetingConfig): Promise<{
    success: boolean
    meeting_id?: string
    join_url?: string
    password?: string
    error?: string
  }> {
    try {
      if (!this.zoomApiKey || !this.zoomApiSecret) {
        return {
          success: false,
          error: 'Zoom API credentials not configured'
        }
      }

      // TODO: 実際のZoom API連携
      // JWT トークン生成とAPI呼び出し
      // const response = await axios.post('https://api.zoom.us/v2/users/me/meetings', config, {
      //   headers: {
      //     'Authorization': `Bearer ${jwtToken}`,
      //     'Content-Type': 'application/json'
      //   }
      // })

      // モック応答
      const mockMeetingId = `${Date.now()}${Math.floor(Math.random() * 1000)}`
      const mockJoinUrl = `https://zoom.us/j/${mockMeetingId}`
      const mockPassword = Math.random().toString(36).substring(2, 8)

      return {
        success: true,
        meeting_id: mockMeetingId,
        join_url: mockJoinUrl,
        password: mockPassword
      }

    } catch (error: any) {
      logger.error('Failed to create Zoom meeting', {
        topic: config.topic,
        error: error.message
      })

      return {
        success: false,
        error: error.message
      }
    }
  }

  // アクセス権限のあるメンバーの取得
  private async getEligibleMembers(accessLevel: string): Promise<Member[]> {
    try {
      // TODO: データベースクエリ
      const allMembers = await this.db.getActiveMembers()
      
      return allMembers.filter(member => {
        if (accessLevel === 'all') return true
        if (accessLevel === 'active') return member.membership_status === 'active'
        if (accessLevel === 'master') return member.plan === 'master'
        return false
      })

    } catch (error: any) {
      logger.error('Failed to get eligible members', { 
        access_level: accessLevel, 
        error: error.message 
      })
      return []
    }
  }

  // 通知のスケジューリング
  private async scheduleNotification(
    seminar: SeminarSchedule,
    notificationTime: Date
  ): Promise<void> {
    try {
      // TODO: スケジューラーへの登録
      // await this.scheduler.scheduleJob(
      //   `seminar-notification-${seminar.id}`,
      //   notificationTime,
      //   () => this.lineNotification.notifySeminarStart(seminar)
      // )

      logger.info('Seminar notification scheduled', {
        seminar_id: seminar.id,
        notification_time: notificationTime.toISOString()
      })

    } catch (error: any) {
      logger.error('Failed to schedule notification', {
        seminar_id: seminar.id,
        error: error.message
      })
    }
  }

  // セミナー統計の更新
  private async updateSeminarStats(seminarId: string, attendeeCount: number): Promise<void> {
    try {
      // TODO: データベース更新
      // await this.db.updateSeminarStats(seminarId, {
      //   attendance_count: attendeeCount,
      //   updated_at: new Date().toISOString()
      // })

      logger.debug('Seminar stats updated', {
        seminar_id: seminarId,
        attendee_count: attendeeCount
      })

    } catch (error: any) {
      logger.error('Failed to update seminar stats', {
        seminar_id: seminarId,
        error: error.message
      })
    }
  }

  // 出席証明書の発行
  private async issueCertificate(seminarId: string, memberId: string): Promise<void> {
    try {
      // TODO: 証明書生成システム
      const certificateId = `cert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

      logger.info('Certificate issued', {
        seminar_id: seminarId,
        member_id: memberId,
        certificate_id: certificateId
      })

      // メンバーへの通知
      await this.notification.sendCertificateIssuedNotification({
        member_id: memberId,
        seminar_id: seminarId,
        certificate_id: certificateId
      })

    } catch (error: any) {
      logger.error('Failed to issue certificate', {
        seminar_id: seminarId,
        member_id: memberId,
        error: error.message
      })
    }
  }
}