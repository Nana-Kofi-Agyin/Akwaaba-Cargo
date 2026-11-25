export type ListingStatus =
  | "open"
  | "closed"
  | "ordered"
  | "shipped"
  | "arrived"
  | "ready";

export type PaymentStatus = "pending" | "paid" | "failed";

export type SmsDeliveryStatus = "sent" | "failed";

export type ShippingMethod = "air" | "sea";

export type DeliveryMethod = "pickup" | "delivery";

export type Database = {
  public: {
    Tables: {
      importers: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          phone: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          phone: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          phone?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      listings: {
        Row: {
          id: string;
          importer_id: string;
          slug: string;
          title: string;
          description: string | null;
          image_url: string | null;
          gallery_urls: string[];
          price_pesewas: number;
          full_price_pesewas: number | null;
          min_qty: number;
          max_qty_per_order: number | null;
          shipping_method: ShippingMethod | null;
          estimated_arrival: string | null;
          pickup_location: string | null;
          delivery_fee_pesewas: number | null;
          deadline: string;
          status: ListingStatus;
          created_at: string;
        };
        Insert: {
          id?: string;
          importer_id: string;
          slug: string;
          title: string;
          description?: string | null;
          image_url?: string | null;
          gallery_urls?: string[];
          price_pesewas: number;
          full_price_pesewas?: number | null;
          min_qty?: number;
          max_qty_per_order?: number | null;
          shipping_method?: ShippingMethod | null;
          estimated_arrival?: string | null;
          pickup_location?: string | null;
          delivery_fee_pesewas?: number | null;
          deadline: string;
          status?: ListingStatus;
          created_at?: string;
        };
        Update: {
          id?: string;
          importer_id?: string;
          slug?: string;
          title?: string;
          description?: string | null;
          image_url?: string | null;
          gallery_urls?: string[];
          price_pesewas?: number;
          full_price_pesewas?: number | null;
          min_qty?: number;
          max_qty_per_order?: number | null;
          shipping_method?: ShippingMethod | null;
          estimated_arrival?: string | null;
          pickup_location?: string | null;
          delivery_fee_pesewas?: number | null;
          deadline?: string;
          status?: ListingStatus;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "listings_importer_id_fkey";
            columns: ["importer_id"];
            isOneToOne: false;
            referencedRelation: "importers";
            referencedColumns: ["id"];
          },
        ];
      };
      orders: {
        Row: {
          id: string;
          listing_id: string;
          buyer_name: string;
          buyer_phone: string;
          momo_phone: string | null;
          qty: number;
          delivery_method: DeliveryMethod;
          delivery_fee_pesewas: number;
          terms_accepted: boolean;
          amount_pesewas: number;
          payment_status: PaymentStatus;
          paystack_reference: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          listing_id: string;
          buyer_name: string;
          buyer_phone: string;
          momo_phone?: string | null;
          qty: number;
          delivery_method?: DeliveryMethod;
          delivery_fee_pesewas?: number;
          terms_accepted?: boolean;
          amount_pesewas: number;
          payment_status?: PaymentStatus;
          paystack_reference: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          listing_id?: string;
          buyer_name?: string;
          buyer_phone?: string;
          momo_phone?: string | null;
          qty?: number;
          delivery_method?: DeliveryMethod;
          delivery_fee_pesewas?: number;
          terms_accepted?: boolean;
          amount_pesewas?: number;
          payment_status?: PaymentStatus;
          paystack_reference?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "orders_listing_id_fkey";
            columns: ["listing_id"];
            isOneToOne: false;
            referencedRelation: "listings";
            referencedColumns: ["id"];
          },
        ];
      };
      status_updates: {
        Row: {
          id: string;
          listing_id: string;
          status: ListingStatus;
          note: string | null;
          proof_image_url: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          listing_id: string;
          status: ListingStatus;
          note?: string | null;
          proof_image_url?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          listing_id?: string;
          status?: ListingStatus;
          note?: string | null;
          proof_image_url?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "status_updates_listing_id_fkey";
            columns: ["listing_id"];
            isOneToOne: false;
            referencedRelation: "listings";
            referencedColumns: ["id"];
          },
        ];
      };
      sms_logs: {
        Row: {
          id: string;
          listing_id: string;
          status_update_id: string;
          recipient_phone: string;
          message: string;
          delivery_status: SmsDeliveryStatus;
          provider_response: string | null;
          error_message: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          listing_id: string;
          status_update_id: string;
          recipient_phone: string;
          message: string;
          delivery_status: SmsDeliveryStatus;
          provider_response?: string | null;
          error_message?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          listing_id?: string;
          status_update_id?: string;
          recipient_phone?: string;
          message?: string;
          delivery_status?: SmsDeliveryStatus;
          provider_response?: string | null;
          error_message?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "sms_logs_listing_id_fkey";
            columns: ["listing_id"];
            isOneToOne: false;
            referencedRelation: "listings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "sms_logs_status_update_id_fkey";
            columns: ["status_update_id"];
            isOneToOne: false;
            referencedRelation: "status_updates";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      listing_status: ListingStatus;
      payment_status: PaymentStatus;
      sms_delivery_status: SmsDeliveryStatus;
      shipping_method: ShippingMethod;
      delivery_method: DeliveryMethod;
    };
    CompositeTypes: Record<string, never>;
  };
}
