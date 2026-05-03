import os
import json
import google.auth
from google.oauth2 import credentials
from google import genai
from google.genai import types
from PIL import Image
from io import BytesIO
import time

# Configuration
CREDS_PATH = os.path.expanduser("~/.gemini/oauth_creds.json")
OUTPUT_DIR = "/Users/kamal/Desktop/ethglobal/demo/gemini/"
MODEL_NAME = "gemini-2.0-flash-exp" # Or gemini-2.0-flash-exp-image-generation

os.makedirs(OUTPUT_DIR, exist_ok=True)

def get_client():
    print(f"Loading credentials from {CREDS_PATH}...")
    if os.path.exists(CREDS_PATH):
        with open(CREDS_PATH, 'r') as f:
            creds_data = json.load(f)
        
        if "refresh_token" in creds_data:
            print("Using authorized user credentials.")
            creds = credentials.Credentials.from_authorized_user_file(CREDS_PATH)
        else:
            print("Credentials format not recognized as authorized user, attempting default auth.")
            creds, _ = google.auth.default()

        # Try to find project ID
        project = creds_data.get("project_id") or creds_data.get("quota_project_id")
        if not project:
            _, project = google.auth.default()
        
        print(f"Initializing GenAI Client with project: {project}")
        return genai.Client(vertexai=True, project=project, credentials=creds)
    else:
        print("Credentials file not found, falling back to default application credentials.")
        creds, project = google.auth.default()
        return genai.Client(vertexai=True, project=project, credentials=creds)

def generate_image(client, filename, prompt):
    print(f"Generating {filename}...")
    try:
        response = client.models.generate_content(
            model=MODEL_NAME,
            contents=prompt,
            config=types.GenerateContentConfig(
                response_modalities=["IMAGE"]
            )
        )
        
        found = False
        if response.candidates and response.candidates[0].content.parts:
            for part in response.candidates[0].content.parts:
                if part.inline_data:
                    image_bytes = part.inline_data.data
                    img = Image.open(BytesIO(image_bytes))
                    save_path = os.path.join(OUTPUT_DIR, filename)
                    img.save(save_path)
                    print(f"Successfully saved to {save_path}")
                    found = True
                    break
        
        if not found:
            print(f"No image data found in response for {filename}")
            print(f"Response: {response}")
            
    except Exception as e:
        print(f"Error generating {filename}: {e}")

def main():
    client = get_client()
    
    images_to_generate = [
        {
            "name": "arena-floor.png",
            "prompt": "Generate a 1024x1024 square image, top-down view of hexagonal arena floor with violet light seams between hex tiles, dark metallic surface with embedded circuit traces, cinematic dramatic lighting, sci-fi tactical map aesthetic, ultra detailed, NO TEXT NO LOGOS"
        },
        {
            "name": "sigil-collage.png",
            "prompt": "Generate a 1792x576 ultra-wide landscape image of abstract crystalline sigils representing 5 protocols floating in dark space, geometric runes with subtle glow in different accent colors cyan orange blue green pink, dark void background, cinematic ultra detailed, NO TEXT NO LOGOS"
        },
        {
            "name": "lineage-tree.png",
            "prompt": "Generate a 1200x800 landscape image of abstract bio-mechanical family tree branches with glowing nodes connected by violet light streams, dark void background, scientific diagram aesthetic, ultra detailed, NO TEXT NO LOGOS NO PEOPLE"
        },
        {
            "name": "encrypt-particles.png",
            "prompt": "Generate a 1024x1024 square image of data particles forming encrypted hash patterns violet streams of binary code condensing into a sealed crystal, dark void background, cinematic ultra detailed sci-fi visualization, NO TEXT NO LOGOS"
        },
        {
            "name": "royalty-flow.png",
            "prompt": "Generate a 1024x1024 square image of golden coin streams flowing upward through bio-mechanical pipes splitting into multiple directions, violet accent lighting, dark background, cinematic ultra detailed sci-fi visualization, NO TEXT NO LOGOS"
        }
    ]
    
    for img_info in images_to_generate:
        generate_image(client, img_info["name"], img_info["prompt"])
        # Small delay to avoid rate limits
        time.sleep(2)

if __name__ == "__main__":
    main()
