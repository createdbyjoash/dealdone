/**
 * DealDone Supabase Service
 * Handles connection to Supabase backend.
 */

// these are the connected project credentials
const SUPABASE_URL = 'https://eubdhvpgaksyhsjqjcbk.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV1YmRodnBnYWtzeWhzanFqY2JrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk0MzIxNTMsImV4cCI6MjA4NTAwODE1M30.PqP5giE9XqjO9FIeD1raHye8vqkRGPZjp3lecbSQJBw';

// Mock Supabase Client if not configured
let supabase = null;

if (SUPABASE_URL && SUPABASE_ANON_KEY && typeof supabasejs !== 'undefined') {
    supabase = supabasejs.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
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
        window.location.href = 'index.html';
    },
    getUser: () => {
        const user = localStorage.getItem('dealDoneUser');
        return user ? JSON.parse(user) : null;
    }
};

const auth = supabase ? supabase.auth : mockAuth;

/**
 * Common Data Access Methods
 */
const db = {
    // Businesses
    getBusinesses: async () => {
        if (supabase) {
            return await supabase.from('businesses').select('*');
        } else {
            // Mock data
            return {
                data: [
                    { id: 1, name: 'CloudScale SaaS', valuation: 1200000, industry: 'Technology', description: 'Profitable SaaS for cloud optimization.', revenue: 300000 },
                    { id: 2, name: 'EcoBrew Coffee', valuation: 450000, industry: 'Food & Beverage', description: 'Sustainable coffee chain with 5 locations.', revenue: 150000 },
                    { id: 3, name: 'Titan Logistics', valuation: 5000000, industry: 'Logistics', description: 'Regional logistics & freight forwarder.', revenue: 2000000 }
                ], error: null
            };
        }
    },

    // Save business profile
    saveBusiness: async (businessData) => {
        if (supabase) {
            // Check if business exists for this owner
            const { data: existing } = await supabase
                .from('businesses')
                .select('id')
                .eq('owner_id', businessData.owner_id)
                .single();

            if (existing) {
                return await supabase
                    .from('businesses')
                    .update(businessData)
                    .eq('id', existing.id);
            } else {
                return await supabase
                    .from('businesses')
                    .insert([businessData]);
            }
        } else {
            console.log('Mock Save Business:', businessData);
            return { data: businessData, error: null };
        }
    }
};

// Export to window for global access in this simple architecture
window.dealDone = {
    supabase,
    auth,
    db,
    configureSupabase
};
