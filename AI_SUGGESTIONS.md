# Future Improvements for AI Face Recognition

## 1. Precise Face-to-ID Mapping (Prevent Cross-Contamination)
**Current Issue:** When a person is tagged in a group photo, the AI doesn't know *which* of the multiple faces belongs to that person. If they don't have a profile picture, the AI might grab the wrong face and use it as their training data.
**The Fix:** When tagging, have the UI display bounding boxes over all detected faces. The user clicks a specific box and assigns a User ID to it. The database then explicitly links the User ID to that exact face descriptor array/box, rather than generically tagging the whole photo.

## 2. Interactive Bounding Boxes
Draw squares around every recognized face when a user views a photo.
* Hovering over a box reveals the recognized name.
* Unknown faces have a clickable "Tag this person" button attached directly to their face box.

## 3. Unknown Face Clustering ("Who is this?")
Create a dedicated "Discover" area.
* The system groups identical unknown faces together.
* Instead of tagging photo by photo, the user is asked "Who is this person?" once, and the system retroactively tags 50 photos at the same time.

## 4. Human-In-The-Loop Verification
For matches where the AI is not confident (distance between 0.48 and 0.55), don't auto-tag or ignore.
* Put the photo in a "Pending Review" queue.
* The UI asks: "Is this Rahul? [Yes] [No]"
* Approving it safely adds the variation to the AI training model.

## 5. Manual "Draw a Box" Overlay
For extreme angles (like 90 degree side-profiles) where the face detection model completely fails to realize a face exists:
* Provide a crop tool in the UI.
* The user draws a rectangle over the side-profile and types a name.
* This overrides the AI and forces a tag even when standard detection is blind.
