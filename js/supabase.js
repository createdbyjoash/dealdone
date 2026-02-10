/**
 * DealDone Supabase Service
 * Handles connection to Supabase backend.
 */

// these are the connected project credentials
const SUPABASE_URL = 'https://eubdhvpgaksyhsjqjcbk.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV1YmRodnBnYWtzeWhzanFqY2JrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk0MzIxNTMsImV4cCI6MjA4NTAwODE1M30.PqP5giE9XqjO9FIeD1raHye8vqkRGPZjp3lecbSQJBw';

// Mock Supabase Client if not configured
let supabaseClient = null;

if (SUPABASE_URL && SUPABASE_ANON_KEY && typeof window.supabase !== 'undefined') {
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

/**
 * Configure Supabase credentials
 */
function configureSupabase(url, key) {
    localStorage.setItem('DEALDONE_SUPABASE_URL', url);
    localStorage.setItem('DEALDONE_SUPABASE_ANON_KEY', key);
    window.location.reload();
}

/**
 * Mock Auth if Supabase is not yet connected
 */
const mockAuth = {
    user: null,
    signUp: async (email, password, metadata) => {
        console.log('Mock Sign Up:', email, metadata);
        const user = { id: 'mock-uuid-' + Math.random(), email, user_metadata: metadata };
        localStorage.setItem('dealDoneUser', JSON.stringify(user));
        return { data: { user }, error: null };
    },
    signIn: async (email, password) => {
        console.log('Mock Sign In:', email);
        const user = { id: 'mock-uuid', email, user_metadata: { full_name: 'John Doe', type: 'owner' } };
        localStorage.setItem('dealDoneUser', JSON.stringify(user));
        return { data: { user }, error: null };
    },
    signOut: async () => {
        localStorage.removeItem('dealDoneUser');
        // window.location.href = 'index.html';
    },
    getUser: () => {
        const user = localStorage.getItem('dealDoneUser');
        return user ? JSON.parse(user) : null;
    },
    // Mock helper to get listings
    getMockBusinesses: () => {
        const biz = localStorage.getItem('dealDoneBusinesses');
        return biz ? JSON.parse(biz) : [];
    },
    // Mock helper to save listings
    saveMockBusiness: (data) => {
        const businesses = mockAuth.getMockBusinesses();
        const index = businesses.findIndex(b => b.owner_id === data.owner_id);

        const newBiz = {
            ...data,
            id: data.id || 'mock-biz-' + Math.random(),
            created_at: data.created_at || new Date().toISOString()
        };

        if (index >= 0) {
            businesses[index] = newBiz;
        } else {
            businesses.push(newBiz);
        }

        localStorage.setItem('dealDoneBusinesses', JSON.stringify(businesses));
        return newBiz;
    }
};

// Create auth wrapper that works with both Supabase and mock
const auth = {
    signUp: async (options) => {
        if (supabaseClient) {
            return await supabaseClient.auth.signUp(options);
        }
        return mockAuth.signUp(options.email, options.password, options.options?.data);
    },

    signInWithPassword: async (credentials) => {
        if (supabaseClient) {
            return await supabaseClient.auth.signInWithPassword(credentials);
        }
        return mockAuth.signIn(credentials.email, credentials.password);
    },

    signOut: async () => {
        if (supabaseClient) {
            await supabaseClient.auth.signOut();
        }
        localStorage.removeItem('dealDoneUser');
        // window.location.href = 'index.html';
    },

    getUser: () => {
        // Fallback to localStorage for synchronous check if needed, 
        // but primary check should be through Supabase session if available
        const user = localStorage.getItem('dealDoneUser');
        return user ? JSON.parse(user) : null;
    },

    getSession: async () => {
        if (supabaseClient) {
            const { data: { session }, error } = await supabaseClient.auth.getSession();
            if (session) {
                localStorage.setItem('dealDoneUser', JSON.stringify(session.user));
                return session;
            }
        }
        return null;
    }
};

/**
 * Common Data Access Methods
 */
const db = {
    // Businesses
    getBusinesses: async () => {
        if (supabaseClient) {
            return await supabaseClient.from('businesses').select('*');
        } else {
            console.log('Mock: Fetching all businesses');
            const data = mockAuth.getMockBusinesses();
            return { data, error: null };
        }
    },

    // Get business by owner ID
    getBusinessByOwner: async (ownerId) => {
        if (supabaseClient) {
            return await supabaseClient
                .from('businesses')
                .select('*')
                .eq('owner_id', ownerId)
                .single();
        } else {
            const businesses = mockAuth.getMockBusinesses();
            const data = businesses.find(b => b.owner_id === ownerId);
            return { data: data || null, error: null };
        }
    },

    // Save business profile
    saveBusiness: async (businessData) => {
        if (supabaseClient) {
            console.log('Supabase: Attempting to save business', businessData);

            // 1. Ensure profile exists (Supabase trigger usually handles this, but let's be sure)
            const { data: profile, error: profileError } = await supabaseClient
                .from('profiles')
                .select('id')
                .eq('id', businessData.owner_id)
                .maybeSingle();

            if (!profile) {
                console.warn('Profile not found, attempting to create one...');
                const user = (await supabaseClient.auth.getUser()).data.user;
                if (user) {
                    await supabaseClient.from('profiles').insert([{
                        id: user.id,
                        full_name: user.user_metadata?.full_name || 'User',
                        user_type: user.user_metadata?.type || 'owner'
                    }]);
                }
            }

            // 2. Check for existing business
            const { data: existing, error: fetchError } = await supabaseClient
                .from('businesses')
                .select('id')
                .eq('owner_id', businessData.owner_id)
                .maybeSingle();

            if (fetchError) {
                console.error('Fetch Error:', fetchError);
                return { data: null, error: fetchError };
            }

            if (existing) {
                console.log('Supabase: Updating business', existing.id);
                const { data, error } = await supabaseClient
                    .from('businesses')
                    .update({
                        name: businessData.name,
                        industry: businessData.industry,
                        revenue: businessData.revenue,
                        valuation: businessData.valuation,
                        description: businessData.description,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', existing.id)
                    .select()
                    .single();

                if (error) console.error('Update Error:', error);
                return { data, error };
            } else {
                console.log('Supabase: Inserting new business');
                const { data, error } = await supabaseClient
                    .from('businesses')
                    .insert([{
                        ...businessData,
                        is_active: true
                    }])
                    .select()
                    .single();

                if (error) console.error('Insert Error:', error);
                return { data, error };
            }
        } else {
            console.log('Mock: Saving business', businessData);
            const data = mockAuth.saveMockBusiness(businessData);
            return { data, error: null };
        }
    },

    // Messages
    getMessages: async (userId) => {
        if (supabaseClient) {
            return await supabaseClient
                .from('messages')
                .select('*')
                .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
                .order('created_at', { ascending: true });
        }
        return { data: [], error: 'No client' };
    },

    sendMessage: async (msgData) => {
        if (supabaseClient) {
            return await supabaseClient.from('messages').insert([msgData]);
        }
        return { error: 'No client' };
    },

    // Get unread message count
    getUnreadCount: async (userId) => {
        if (supabaseClient) {
            const { count, error } = await supabaseClient
                .from('messages')
                .select('*', { count: 'exact', head: true })
                .eq('receiver_id', userId)
                .eq('is_read', false);
            return { count: count || 0, error };
        }
        return { count: 0, error: 'No client' };
    },

    // Mark messages as read
    markAsRead: async (messageIds) => {
        if (supabaseClient) {
            return await supabaseClient
                .from('messages')
                .update({ is_read: true })
                .in('id', messageIds);
        }
        return { error: 'No client' };
    },

    // Subscribe to new messages (real-time)
    subscribeToMessages: (userId, callback) => {
        if (supabaseClient) {
            const channel = supabaseClient
                .channel('messages')
                .on(
                    'postgres_changes',
                    {
                        event: 'INSERT',
                        schema: 'public',
                        table: 'messages',
                        filter: `receiver_id=eq.${userId}`
                    },
                    (payload) => {
                        callback(payload.new);
                    }
                )
                .subscribe();

            return channel;
        }
        return null;
    },

    // Unsubscribe from real-time updates
    unsubscribe: (channel) => {
        if (channel && supabaseClient) {
            supabaseClient.removeChannel(channel);
        }
    }
};

// Export to window for global access in this simple architecture
window.dealDone = {
    supabase: supabaseClient,
    auth,
    db,
    configureSupabase
};
