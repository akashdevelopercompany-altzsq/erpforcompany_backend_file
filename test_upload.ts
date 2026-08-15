
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// Load env (simplified, usually nest does this)
const supabaseUrl = process.env.SUPABASE_URL || 'https://wqqpafsisdnsgpwipyqg.supabase.co';
const supabaseKey = process.env.SUPABASE_KEY || process.env.JWT_SECRET || 'placeholder';

console.log('Testing Supabase Upload...');
console.log('URL:', supabaseUrl);
// console.log('Key:', supabaseKey); // Don't log secret

const supabase = createClient(supabaseUrl, supabaseKey);

async function testUpload() {
    const bucketName = 'project-files';
    const folder = 'Call Recording';
    const fileName = `test-upload-${Date.now()}.txt`;
    const filePath = path.join(process.cwd(), fileName);

    fs.writeFileSync(filePath, 'This is a test recording file content.');

    try {
        console.log(`Checking bucket ${bucketName}...`);
        const { data: buckets, error: listError } = await supabase.storage.listBuckets();
        if (listError) console.error('List Buckets Error:', listError);
        else {
            const exists = buckets?.find(b => b.name === bucketName);
            console.log(`Bucket '${bucketName}' exists:`, !!exists);
            if (!exists) {
                console.log('Creating bucket...');
                const { error: createError } = await supabase.storage.createBucket(bucketName, { public: true });
                if (createError) console.error('Create Bucket Error:', createError);
            }
        }

        console.log(`Uploading ${fileName} to ${bucketName}/${folder}...`);

        const fileBuffer = fs.readFileSync(filePath);
        const { data, error } = await supabase
            .storage
            .from(bucketName)
            .upload(`${folder}/${fileName}`, fileBuffer, {
                contentType: 'text/plain',
                upsert: true
            });

        if (error) {
            console.error('Upload Failed Full Error:', JSON.stringify(error, null, 2));
        } else {
            console.log('Upload Success:', data);

            // 3. Get Public URL
            const { data: { publicUrl } } = supabase
                .storage
                .from(bucketName)
                .getPublicUrl(`${folder}/${fileName}`);

            console.log('Public URL:', publicUrl);
        }

    } catch (e) {
        console.error('Exception:', e);
    } finally {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
}

testUpload();
