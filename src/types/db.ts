export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: { extensions?: Json; operationName?: string; query?: string; variables?: Json };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      api_usage: {
        Row: {
          count: number;
          day: string;
          kind: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          count?: number;
          day: string;
          kind: string;
          user_id: string;
        };
        Update: {
          count?: number;
          day?: string;
          kind?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      chat_messages: {
        Row: {
          content: string;
          created_at: string;
          id: string;
          member_id: string | null;
          model: string | null;
          proposal: Json | null;
          proposal_applied: boolean;
          provider: string | null;
          role: string;
          trip_id: string;
        };
        ComputedFields: never;
        Insert: {
          content: string;
          created_at?: string;
          id?: string;
          member_id?: string | null;
          model?: string | null;
          proposal?: Json | null;
          proposal_applied?: boolean;
          provider?: string | null;
          role: string;
          trip_id: string;
        };
        Update: {
          content?: string;
          created_at?: string;
          id?: string;
          member_id?: string | null;
          model?: string | null;
          proposal?: Json | null;
          proposal_applied?: boolean;
          provider?: string | null;
          role?: string;
          trip_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'chat_messages_member_id_fkey';
            columns: ['member_id'];
            isOneToOne: false;
            referencedRelation: 'members';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'chat_messages_trip_id_fkey';
            columns: ['trip_id'];
            isOneToOne: false;
            referencedRelation: 'trips';
            referencedColumns: ['id'];
          },
        ];
      };
      checklist_items: {
        Row: {
          checked: boolean;
          checked_by: string | null;
          created_at: string;
          id: string;
          position: number;
          section: string;
          title: string;
          trip_id: string;
        };
        ComputedFields: never;
        Insert: {
          checked?: boolean;
          checked_by?: string | null;
          created_at?: string;
          id?: string;
          position?: number;
          section: string;
          title: string;
          trip_id: string;
        };
        Update: {
          checked?: boolean;
          checked_by?: string | null;
          created_at?: string;
          id?: string;
          position?: number;
          section?: string;
          title?: string;
          trip_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'checklist_items_trip_id_fkey';
            columns: ['trip_id'];
            isOneToOne: false;
            referencedRelation: 'trips';
            referencedColumns: ['id'];
          },
        ];
      };
      expense_splits: {
        Row: {
          expense_id: string;
          member_id: string;
          share_krw: number;
        };
        ComputedFields: never;
        Insert: {
          expense_id: string;
          member_id: string;
          share_krw: number;
        };
        Update: {
          expense_id?: string;
          member_id?: string;
          share_krw?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'expense_splits_expense_id_fkey';
            columns: ['expense_id'];
            isOneToOne: false;
            referencedRelation: 'expenses';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'expense_splits_member_id_fkey';
            columns: ['member_id'];
            isOneToOne: false;
            referencedRelation: 'members';
            referencedColumns: ['id'];
          },
        ];
      };
      expenses: {
        Row: {
          amount: number;
          amount_krw: number;
          category: string;
          created_at: string;
          created_by: string;
          currency: string;
          day_index: number | null;
          exchange_rate: number;
          id: string;
          memo: string | null;
          paid_by: string;
          payment_method: string;
          place_id: string | null;
          place_label: string | null;
          receipt_path: string | null;
          spent_on: string | null;
          title: string;
          trip_id: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          amount: number;
          amount_krw: number;
          category?: string;
          created_at?: string;
          created_by?: string;
          currency: string;
          day_index?: number | null;
          exchange_rate?: number;
          id?: string;
          memo?: string | null;
          paid_by: string;
          payment_method?: string;
          place_id?: string | null;
          place_label?: string | null;
          receipt_path?: string | null;
          spent_on?: string | null;
          title: string;
          trip_id: string;
          updated_at?: string;
        };
        Update: {
          amount?: number;
          amount_krw?: number;
          category?: string;
          created_at?: string;
          created_by?: string;
          currency?: string;
          day_index?: number | null;
          exchange_rate?: number;
          id?: string;
          memo?: string | null;
          paid_by?: string;
          payment_method?: string;
          place_id?: string | null;
          place_label?: string | null;
          receipt_path?: string | null;
          spent_on?: string | null;
          title?: string;
          trip_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'expenses_paid_by_fkey';
            columns: ['paid_by'];
            isOneToOne: false;
            referencedRelation: 'members';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'expenses_place_id_fkey';
            columns: ['place_id'];
            isOneToOne: false;
            referencedRelation: 'places';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'expenses_trip_id_fkey';
            columns: ['trip_id'];
            isOneToOne: false;
            referencedRelation: 'trips';
            referencedColumns: ['id'];
          },
        ];
      };
      footprints: {
        Row: {
          code: string;
          created_at: string;
          id: string;
          kind: string;
          memo: string | null;
          period: string | null;
          status: string;
          trip_id: string | null;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          code: string;
          created_at?: string;
          id?: string;
          kind: string;
          memo?: string | null;
          period?: string | null;
          status: string;
          trip_id?: string | null;
          user_id?: string;
        };
        Update: {
          code?: string;
          created_at?: string;
          id?: string;
          kind?: string;
          memo?: string | null;
          period?: string | null;
          status?: string;
          trip_id?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'footprints_trip_id_fkey';
            columns: ['trip_id'];
            isOneToOne: false;
            referencedRelation: 'trips';
            referencedColumns: ['id'];
          },
        ];
      };
      members: {
        Row: {
          color: string;
          id: string;
          joined_at: string;
          nickname: string;
          role: string;
          trip_id: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          color?: string;
          id?: string;
          joined_at?: string;
          nickname: string;
          role?: string;
          trip_id: string;
          user_id: string;
        };
        Update: {
          color?: string;
          id?: string;
          joined_at?: string;
          nickname?: string;
          role?: string;
          trip_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'members_trip_id_fkey';
            columns: ['trip_id'];
            isOneToOne: false;
            referencedRelation: 'trips';
            referencedColumns: ['id'];
          },
        ];
      };
      place_photos: {
        Row: {
          created_at: string;
          created_by: string;
          id: string;
          place_id: string;
          storage_path: string;
          trip_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          created_by?: string;
          id?: string;
          place_id: string;
          storage_path: string;
          trip_id: string;
        };
        Update: {
          created_at?: string;
          created_by?: string;
          id?: string;
          place_id?: string;
          storage_path?: string;
          trip_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'place_photos_place_id_fkey';
            columns: ['place_id'];
            isOneToOne: false;
            referencedRelation: 'places';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'place_photos_trip_id_fkey';
            columns: ['trip_id'];
            isOneToOne: false;
            referencedRelation: 'trips';
            referencedColumns: ['id'];
          },
        ];
      };
      place_reviews: {
        Row: {
          comment: string | null;
          created_at: string;
          id: string;
          member_id: string;
          place_id: string;
          rating: number;
          trip_id: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          comment?: string | null;
          created_at?: string;
          id?: string;
          member_id: string;
          place_id: string;
          rating: number;
          trip_id: string;
          updated_at?: string;
        };
        Update: {
          comment?: string | null;
          created_at?: string;
          id?: string;
          member_id?: string;
          place_id?: string;
          rating?: number;
          trip_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'place_reviews_member_id_fkey';
            columns: ['member_id'];
            isOneToOne: false;
            referencedRelation: 'members';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'place_reviews_place_id_fkey';
            columns: ['place_id'];
            isOneToOne: false;
            referencedRelation: 'places';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'place_reviews_trip_id_fkey';
            columns: ['trip_id'];
            isOneToOne: false;
            referencedRelation: 'trips';
            referencedColumns: ['id'];
          },
        ];
      };
      places: {
        Row: {
          address: string | null;
          category: string;
          created_at: string;
          created_by: string;
          day_index: number | null;
          end_time: string | null;
          google_place_id: string | null;
          id: string;
          is_indoor: boolean | null;
          lat: number | null;
          leg_distance_m: number | null;
          leg_duration_s: number | null;
          leg_estimated: boolean;
          leg_from_place_id: string | null;
          leg_mode: string | null;
          leg_polyline: string | null;
          lng: number | null;
          name: string;
          note: string | null;
          position: number;
          source: string;
          start_time: string | null;
          trip_id: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          address?: string | null;
          category?: string;
          created_at?: string;
          created_by?: string;
          day_index?: number | null;
          end_time?: string | null;
          google_place_id?: string | null;
          id?: string;
          is_indoor?: boolean | null;
          lat?: number | null;
          leg_distance_m?: number | null;
          leg_duration_s?: number | null;
          leg_estimated?: boolean;
          leg_from_place_id?: string | null;
          leg_mode?: string | null;
          leg_polyline?: string | null;
          lng?: number | null;
          name: string;
          note?: string | null;
          position?: number;
          source?: string;
          start_time?: string | null;
          trip_id: string;
          updated_at?: string;
        };
        Update: {
          address?: string | null;
          category?: string;
          created_at?: string;
          created_by?: string;
          day_index?: number | null;
          end_time?: string | null;
          google_place_id?: string | null;
          id?: string;
          is_indoor?: boolean | null;
          lat?: number | null;
          leg_distance_m?: number | null;
          leg_duration_s?: number | null;
          leg_estimated?: boolean;
          leg_from_place_id?: string | null;
          leg_mode?: string | null;
          leg_polyline?: string | null;
          lng?: number | null;
          name?: string;
          note?: string | null;
          position?: number;
          source?: string;
          start_time?: string | null;
          trip_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'places_trip_id_fkey';
            columns: ['trip_id'];
            isOneToOne: false;
            referencedRelation: 'trips';
            referencedColumns: ['id'];
          },
        ];
      };
      reservations: {
        Row: {
          amount: number | null;
          confirmation_no: string | null;
          created_at: string;
          created_by: string;
          currency: string | null;
          ends_at: string | null;
          id: string;
          note: string | null;
          place_id: string | null;
          starts_at: string | null;
          title: string;
          trip_id: string;
          type: string;
          url: string | null;
        };
        ComputedFields: never;
        Insert: {
          amount?: number | null;
          confirmation_no?: string | null;
          created_at?: string;
          created_by?: string;
          currency?: string | null;
          ends_at?: string | null;
          id?: string;
          note?: string | null;
          place_id?: string | null;
          starts_at?: string | null;
          title: string;
          trip_id: string;
          type?: string;
          url?: string | null;
        };
        Update: {
          amount?: number | null;
          confirmation_no?: string | null;
          created_at?: string;
          created_by?: string;
          currency?: string | null;
          ends_at?: string | null;
          id?: string;
          note?: string | null;
          place_id?: string | null;
          starts_at?: string | null;
          title?: string;
          trip_id?: string;
          type?: string;
          url?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'reservations_place_id_fkey';
            columns: ['place_id'];
            isOneToOne: false;
            referencedRelation: 'places';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'reservations_trip_id_fkey';
            columns: ['trip_id'];
            isOneToOne: false;
            referencedRelation: 'trips';
            referencedColumns: ['id'];
          },
        ];
      };
      saved_places: {
        Row: {
          address: string | null;
          category: string;
          city: string | null;
          country_code: string | null;
          created_at: string;
          google_place_id: string;
          id: string;
          lat: number | null;
          lng: number | null;
          memo: string | null;
          name: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          address?: string | null;
          category?: string;
          city?: string | null;
          country_code?: string | null;
          created_at?: string;
          google_place_id: string;
          id?: string;
          lat?: number | null;
          lng?: number | null;
          memo?: string | null;
          name: string;
          user_id?: string;
        };
        Update: {
          address?: string | null;
          category?: string;
          city?: string | null;
          country_code?: string | null;
          created_at?: string;
          google_place_id?: string;
          id?: string;
          lat?: number | null;
          lng?: number | null;
          memo?: string | null;
          name?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      settlements: {
        Row: {
          amount_krw: number;
          created_by: string;
          from_member: string;
          id: string;
          settled_at: string;
          to_member: string;
          trip_id: string;
        };
        ComputedFields: never;
        Insert: {
          amount_krw: number;
          created_by?: string;
          from_member: string;
          id?: string;
          settled_at?: string;
          to_member: string;
          trip_id: string;
        };
        Update: {
          amount_krw?: number;
          created_by?: string;
          from_member?: string;
          id?: string;
          settled_at?: string;
          to_member?: string;
          trip_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'settlements_from_member_fkey';
            columns: ['from_member'];
            isOneToOne: false;
            referencedRelation: 'members';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'settlements_to_member_fkey';
            columns: ['to_member'];
            isOneToOne: false;
            referencedRelation: 'members';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'settlements_trip_id_fkey';
            columns: ['trip_id'];
            isOneToOne: false;
            referencedRelation: 'trips';
            referencedColumns: ['id'];
          },
        ];
      };
      trip_destinations: {
        Row: {
          city: string | null;
          country_code: string;
          id: string;
          lat: number | null;
          lng: number | null;
          position: number;
          trip_id: string;
        };
        ComputedFields: never;
        Insert: {
          city?: string | null;
          country_code: string;
          id?: string;
          lat?: number | null;
          lng?: number | null;
          position?: number;
          trip_id: string;
        };
        Update: {
          city?: string | null;
          country_code?: string;
          id?: string;
          lat?: number | null;
          lng?: number | null;
          position?: number;
          trip_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'trip_destinations_trip_id_fkey';
            columns: ['trip_id'];
            isOneToOne: false;
            referencedRelation: 'trips';
            referencedColumns: ['id'];
          },
        ];
      };
      trip_files: {
        Row: {
          created_at: string;
          created_by: string;
          id: string;
          kind: string;
          mime_type: string | null;
          reservation_id: string | null;
          size_bytes: number | null;
          storage_path: string | null;
          title: string;
          trip_id: string;
          url: string | null;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          created_by?: string;
          id?: string;
          kind: string;
          mime_type?: string | null;
          reservation_id?: string | null;
          size_bytes?: number | null;
          storage_path?: string | null;
          title: string;
          trip_id: string;
          url?: string | null;
        };
        Update: {
          created_at?: string;
          created_by?: string;
          id?: string;
          kind?: string;
          mime_type?: string | null;
          reservation_id?: string | null;
          size_bytes?: number | null;
          storage_path?: string | null;
          title?: string;
          trip_id?: string;
          url?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'trip_files_reservation_id_fkey';
            columns: ['reservation_id'];
            isOneToOne: false;
            referencedRelation: 'reservations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'trip_files_trip_id_fkey';
            columns: ['trip_id'];
            isOneToOne: false;
            referencedRelation: 'trips';
            referencedColumns: ['id'];
          },
        ];
      };
      trips: {
        Row: {
          ai_fallback: boolean;
          ai_model: string | null;
          ai_provider: string;
          base_currency: string;
          budget_krw: number | null;
          cover_emoji: string | null;
          created_at: string;
          created_by: string;
          end_date: string;
          headcount: number | null;
          id: string;
          invite_token: string | null;
          planning_prefs: Json | null;
          recap: Json | null;
          start_date: string;
          title: string;
          updated_at: string;
          view_token: string | null;
        };
        ComputedFields: never;
        Insert: {
          ai_fallback?: boolean;
          ai_model?: string | null;
          ai_provider?: string;
          base_currency?: string;
          budget_krw?: number | null;
          cover_emoji?: string | null;
          created_at?: string;
          created_by?: string;
          end_date: string;
          headcount?: number | null;
          id?: string;
          invite_token?: string | null;
          planning_prefs?: Json | null;
          recap?: Json | null;
          start_date: string;
          title: string;
          updated_at?: string;
          view_token?: string | null;
        };
        Update: {
          ai_fallback?: boolean;
          ai_model?: string | null;
          ai_provider?: string;
          base_currency?: string;
          budget_krw?: number | null;
          cover_emoji?: string | null;
          created_at?: string;
          created_by?: string;
          end_date?: string;
          headcount?: number | null;
          id?: string;
          invite_token?: string | null;
          planning_prefs?: Json | null;
          recap?: Json | null;
          start_date?: string;
          title?: string;
          updated_at?: string;
          view_token?: string | null;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      _copy_trip: {
        Args: { p_checklist: boolean; p_nickname: string; p_src: string; p_start: string; p_title: string };
        Returns: string;
      };
      bump_usage: { Args: { p_kind: string; p_limit: number; p_user: string }; Returns: boolean };
      create_trip: {
        Args: { p_destinations?: Json; p_end: string; p_nickname: string; p_start: string; p_title: string };
        Returns: string;
      };
      duplicate_trip: {
        Args: { p_checklist?: boolean; p_nickname: string; p_src: string; p_start: string; p_title: string };
        Returns: string;
      };
      get_shared_trip: { Args: { p_token: string }; Returns: Json };
      import_shared_trip: {
        Args: { p_nickname: string; p_start: string; p_title: string; p_view_token: string };
        Returns: string;
      };
      is_me: { Args: { m: string }; Returns: boolean };
      is_trip_member: { Args: { t: string }; Returns: boolean };
      is_trip_owner: { Args: { t: string }; Returns: boolean };
      join_trip: { Args: { p_nickname: string; p_token: string }; Returns: string };
      peek_invite: {
        Args: { p_token: string };
        Returns: {
          end_date: string;
          member_count: number;
          start_date: string;
          title: string;
        }[];
      };
      save_expense: { Args: { p_data: Json; p_id: string; p_splits: Json; p_trip: string }; Returns: string };
      set_invite: { Args: { p_enabled: boolean; p_trip: string }; Returns: string };
      set_view_link: { Args: { p_enabled: boolean; p_trip: string }; Returns: string };
      storage_trip_id: { Args: { p_name: string }; Returns: string };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    keyof (DefaultSchema['Tables'] & DefaultSchema['Views']) | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema['Enums'] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema['CompositeTypes'] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const;
