'use strict';

(() => {
  const translations = {
    'Home': 'முகப்பு',
    'Together for a stronger tomorrow': 'வலுவான நாளைக்காக ஒன்றிணைவோம்',
    'PTK party website and membership platform': 'PTK கட்சி இணையதளம் மற்றும் உறுப்பினர் தளம்',
    'About': 'எங்களைப் பற்றி',
    'Already applied?': 'ஏற்கனவே விண்ணப்பித்துவிட்டீர்களா?',
    'Vision': 'தொலைநோக்கு',
    'Announcements': 'அறிவிப்புகள்',
    'Events': 'நிகழ்வுகள்',
    'Membership': 'உறுப்பினர் சேர்க்கை',
    'Admin': 'நிர்வாகம்',
    'Welcome to PTK': 'PTK-க்கு வரவேற்கிறோம்',
    'Apply for Membership': 'உறுப்பினர் சேர்க்கைக்கு விண்ணப்பிக்கவும்',
    'Latest Updates': 'சமீபத்திய செய்திகள்',
    'Members': 'உறுப்பினர்கள்',
    'Districts': 'மாவட்டங்கள்',
    'Volunteers': 'தன்னார்வலர்கள்',
    'Party President': 'கட்சித் தலைவர்',
    'PTK Leadership': 'PTK தலைமை',
    'PTK Headquarters, Tamil Nadu': 'PTK தலைமையகம், தமிழ்நாடு',
    'Email:': 'மின்னஞ்சல்:',
    'Phone:': 'தொலைபேசி:',
    'Address:': 'முகவரி:',
    'About PTK': 'PTK பற்றி',
    'Building a strong, inclusive political future': 'வலுவான, அனைவரையும் உள்ளடக்கிய அரசியல் எதிர்காலத்தை உருவாக்குதல்',
    'Our Legacy': 'நமது மரபு',
    'PTK is a people-first political movement founded on integrity, service, and progress for every community.': 'PTK என்பது நேர்மை, சேவை மற்றும் ஒவ்வொரு சமூகத்தின் முன்னேற்றம் ஆகியவற்றை அடிப்படையாகக் கொண்ட மக்கள் முன்னுரிமை அரசியல் இயக்கமாகும்.',
    'Mission': 'பணி',
    'To build a just, people-led, transparent and inclusive political future for Tamil communities.': 'தமிழ்ச் சமூகங்களுக்காக நீதியான, மக்கள் வழிநடத்தும், வெளிப்படையான மற்றும் அனைவரையும் உள்ளடக்கிய அரசியல் எதிர்காலத்தை உருவாக்குதல்.',
    'To create a vibrant, responsive, and democratic society driven by dignity, opportunity and unity.': 'கண்ணியம், வாய்ப்பு மற்றும் ஒற்றுமையால் வழிநடத்தப்படும் துடிப்பான, மக்களுக்குப் பதிலளிக்கும் ஜனநாயகச் சமூகத்தை உருவாக்குதல்.',
    'Core Principles': 'அடிப்படைக் கொள்கைகள்',
    'Values that guide our work': 'எங்கள் பணிக்கு வழிகாட்டும் மதிப்புகள்',
    'People First': 'மக்களே முதன்மை',
    'We serve communities through direct engagement, ethical governance and long-term development.': 'நேரடி ஈடுபாடு, அறநெறி ஆட்சி மற்றும் நீண்டகால வளர்ச்சி மூலம் சமூகங்களுக்குச் சேவை செய்கிறோம்.',
    'Integrity': 'நேர்மை',
    'Our politics are grounded in accountability, transparency and honest public leadership.': 'பொறுப்புணர்வு, வெளிப்படைத்தன்மை மற்றும் நேர்மையான பொது தலைமையே எங்கள் அரசியலின் அடிப்படை.',
    'Progress': 'முன்னேற்றம்',
    'We work to improve livelihoods, infrastructure, education, healthcare and opportunity for all.': 'வாழ்வாதாரம், உட்கட்டமைப்பு, கல்வி, சுகாதாரம் மற்றும் அனைவருக்குமான வாய்ப்புகளை மேம்படுத்தப் பணியாற்றுகிறோம்.',
    'Unity': 'ஒற்றுமை',
    'We bring together workers, youth, women, farmers and professionals around common goals.': 'தொழிலாளர்கள், இளைஞர்கள், பெண்கள், விவசாயிகள் மற்றும் நிபுணர்களை பொதுவான இலக்குகளுக்காக ஒன்றிணைக்கிறோம்.',
    'Latest updates from PTK': 'PTK-இன் சமீபத்திய செய்திகள்',
    'Upcoming public engagements': 'வரவிருக்கும் பொதுநிகழ்வுகள்',
    'Location:': 'இடம்:',
    'Location': 'இடம்',
    'Description': 'விளக்கம்',
    'Date:': 'தேதி:',
    'Get Involved': 'பங்கேற்கவும்',
    'Join the movement': 'இயக்கத்தில் இணையுங்கள்',
    'Membership application': 'உறுப்பினர் விண்ணப்பம்',
    'Become a member and help build a stronger political future.': 'உறுப்பினராகி வலுவான அரசியல் எதிர்காலத்தை உருவாக்க உதவுங்கள்.',
    'Apply now': 'இப்போது விண்ணப்பிக்கவும்',
    'Volunteer with PTK': 'PTK-உடன் தன்னார்வலராகப் பணியாற்றுங்கள்',
    'Support campaigns, social work, and community outreach.': 'பிரச்சாரங்கள், சமூகப் பணிகள் மற்றும் மக்கள் தொடர்புப் பணிகளுக்கு ஆதரவளியுங்கள்.',
    'Volunteer': 'தன்னார்வலர்',
    'Raise a grievance': 'குறையைத் தெரிவிக்கவும்',
    'Share your concern for appropriate review by the party team.': 'கட்சிக் குழு பரிசீலிக்க உங்கள் குறையைப் பகிரவும்.',
    'Report': 'தெரிவிக்கவும்',
    'Public Forms': 'பொது விண்ணப்பங்கள்',
    'Submit your details securely': 'உங்கள் விவரங்களைப் பாதுகாப்பாகச் சமர்ப்பிக்கவும்',
    'Volunteer registration': 'தன்னார்வலர் பதிவு',
    'Full name': 'முழுப் பெயர்',
    'Name': 'பெயர்',
    'Phone': 'தொலைபேசி',
    'Email': 'மின்னஞ்சல்',
    'District': 'மாவட்டம்',
    'District:': 'மாவட்டம்:',
    'Area of interest': 'ஆர்வமுள்ள துறை',
    'Availability': 'கிடைக்கும் நேரம்',
    'Message': 'செய்தி',
    'Submit': 'சமர்ப்பிக்கவும்',
    'Public grievance': 'பொதுமக்கள் குறை',
    'Subject': 'பொருள்',
    'Send grievance': 'குறையை அனுப்பவும்',
    'Contact PTK': 'PTK-ஐத் தொடர்புகொள்ளவும்',
    'Send message': 'செய்தியை அனுப்பவும்',
    'Quick Links': 'விரைவு இணைப்புகள்',
    'Resources': 'வளங்கள்',
    'Contact': 'தொடர்பு',
    'Admin Login': 'நிர்வாகி உள்நுழைவு',
    'Admin Dashboard': 'நிர்வாகப் பலகை',
    'Announcements': 'அறிவிப்புகள்',
    'Branding Settings': 'அடையாள அமைப்புகள்',
    'Website Content': 'இணையதள உள்ளடக்கம்',
    'Backup & Restore': 'காப்புப்பிரதி மற்றும் மீட்டமைப்பு',
    'Contact Requests': 'தொடர்பு கோரிக்கைகள்',
    'Public contact form submissions': 'பொது தொடர்புப் படிவச் சமர்ப்பிப்புகள்',
    'Public grievance submissions': 'பொதுமக்கள் குறைச் சமர்ப்பிப்புகள்',
    'Reference': 'குறிப்பு எண்',
    'View message': 'செய்தியைப் பார்க்கவும்',
    'View grievance': 'குறையைப் பார்க்கவும்',
    'Contact request status': 'தொடர்பு கோரிக்கை நிலை',
    'Grievance status': 'குறை நிலை',
    'New': 'புதியது',
    'In progress': 'செயல்பாட்டில் உள்ளது',
    'Resolved': 'தீர்க்கப்பட்டது',
    'Update status': 'நிலையைப் புதுப்பிக்கவும்',
    'Contact request status updated.': 'தொடர்பு கோரிக்கை நிலை புதுப்பிக்கப்பட்டது.',
    'Grievance status updated.': 'குறை நிலை புதுப்பிக்கப்பட்டது.',
    'Contact request deleted.': 'தொடர்பு கோரிக்கை நீக்கப்பட்டது.',
    'Grievance deleted.': 'குறை நீக்கப்பட்டது.',
    'Volunteer registration deleted.': 'தன்னார்வலர் பதிவு நீக்கப்பட்டது.',
    'Volunteer approved. An active member and card were created.': 'தன்னார்வலர் அங்கீகரிக்கப்பட்டார். செயலில் உள்ள உறுப்பினரும் அட்டையும் உருவாக்கப்பட்டன.',
    'Volunteer member and card deactivated.': 'தன்னார்வலர் உறுப்பினரும் அட்டையும் செயலிழக்கச் செய்யப்பட்டன.',
    'Volunteer member and card reactivated.': 'தன்னார்வலர் உறுப்பினரும் அட்டையும் மீண்டும் செயல்படுத்தப்பட்டன.',
    'Volunteer member profile saved.': 'தன்னார்வலர் உறுப்பினர் விவரங்கள் சேமிக்கப்பட்டன.',
    'Any issued membership remains in the member directory.': 'ஏற்கனவே வழங்கப்பட்ட உறுப்பினர் அட்டை உறுப்பினர் பட்டியலில் தொடரும்.',
    'Permanently delete this contact request?': 'இந்த தொடர்பு கோரிக்கையை நிரந்தரமாக நீக்கவா?',
    'Permanently delete this grievance?': 'இந்த குறையை நிரந்தரமாக நீக்கவா?',
    'Permanently delete this volunteer registration?': 'இந்த தன்னார்வலர் பதிவை நிரந்தரமாக நீக்கவா?',
    'No contact requests have been submitted yet.': 'தொடர்பு கோரிக்கைகள் எதுவும் இன்னும் வரவில்லை.',
    'No grievances have been submitted yet.': 'குறைகள் எதுவும் இன்னும் சமர்ப்பிக்கப்படவில்லை.',
    'No volunteer registrations have been submitted yet.': 'தன்னார்வலர் பதிவுகள் எதுவும் இன்னும் சமர்ப்பிக்கப்படவில்லை.',
    'District / Interest': 'மாவட்டம் / ஆர்வம்',
    'Member / Card': 'உறுப்பினர் / அட்டை',
    'Volunteer message': 'தன்னார்வலர் செய்தி',
    'Admin note': 'நிர்வாகக் குறிப்பு',
    'Availability:': 'கிடைக்கும் நேரம்:',
    'Card active': 'அட்டை செயல்பாட்டில்',
    'Card inactive': 'அட்டை செயலிழந்தது',
    'Not issued': 'வழங்கப்படவில்லை',
    'Edit member details': 'உறுப்பினர் விவரங்களைத் திருத்து',
    'Approval note': 'ஒப்புதல் குறிப்பு',
    'Status note': 'நிலை குறிப்பு',
    'Admin note (optional)': 'நிர்வாகக் குறிப்பு (விருப்பமானது)',
    'Approve & issue card': 'அங்கீகரித்து அட்டை வழங்கு',
    'Complete and save the member details before approval.': 'அங்கீகரிப்பதற்கு முன் உறுப்பினர் விவரங்களைப் பூர்த்தி செய்து சேமிக்கவும்.',
    'Grievances': 'குறைகள்',
    'Reports': 'அறிக்கைகள்',
    'Volunteers': 'தன்னார்வலர்கள்',
    'Member Management': 'உறுப்பினர் நிர்வாகம்',
    'Membership Application': 'உறுப்பினர் விண்ணப்பம்',
    'Membership Verification': 'உறுப்பினர் சரிபார்ப்பு',
    'Page Not Found': 'பக்கம் கிடைக்கவில்லை',
    'Member status lookup': 'உறுப்பினர் நிலையைப் பார்க்கவும்',
    'Application status lookup': 'விண்ணப்ப நிலையைப் பார்க்கவும்',
    'Application status': 'விண்ணப்ப நிலை',
    'Check application status': 'விண்ணப்ப நிலையைப் பார்க்கவும்',
    'Check status': 'நிலையைப் பார்க்கவும்',
    'Enter your application reference and phone number to check your application status.': 'விண்ணப்ப நிலையை அறிய உங்கள் விண்ணப்பக் குறிப்பு எண்ணையும் தொலைபேசி எண்ணையும் உள்ளிடவும்.',
    'Enter the application reference shown after you applied, or your member ID, and the phone number used in the application. Spaces and phone formatting such as +91, dashes, and parentheses are accepted.': 'விண்ணப்பித்த பிறகு வழங்கப்பட்ட விண்ணப்பக் குறிப்பு எண் அல்லது உறுப்பினர் அடையாள எண் மற்றும் விண்ணப்பத்தில் பயன்படுத்திய தொலைபேசி எண்ணை உள்ளிடவும். +91, இடைவெளி, கோடு, அடைப்புக்குறி போன்ற தொலைபேசி வடிவங்கள் ஏற்கப்படும்.',
    'Application reference': 'விண்ணப்பக் குறிப்பு எண்',
    'Application reference or member ID': 'விண்ணப்பக் குறிப்பு எண் அல்லது உறுப்பினர் அடையாள எண்',
    'Phone number used in the application': 'விண்ணப்பத்தில் கொடுத்த தொலைபேசி எண்',
    'Application not found. Check the reference and phone number and try again.': 'விண்ணப்பம் கிடைக்கவில்லை. குறிப்பு எண் மற்றும் தொலைபேசி எண்ணைச் சரிபார்த்து மீண்டும் முயற்சிக்கவும்.',
    'Application details': 'விண்ணப்ப விவரங்கள்',
    'Applicant:': 'விண்ணப்பதாரர்:',
    'Submitted:': 'சமர்ப்பிக்கப்பட்டது:',
    'Status:': 'நிலை:',
    'Reference:': 'குறிப்பு எண்:',
    'Category': 'வகை',
    'Date': 'தேதி',
    'Date:': 'தேதி:',
    'Member ID:': 'உறுப்பினர் அடையாள எண்:',
    'Reference / Date': 'குறிப்பு எண் / தேதி',
    'Full address — important': 'முழு முகவரி — முக்கியம்',
    'Full address — required': 'முழு முகவரி — அவசியம்',
    'Member / Phone': 'உறுப்பினர் / தொலைபேசி',
    'Member ID / Date': 'உறுப்பினர் அடையாள எண் / தேதி',
    'Member directory': 'உறுப்பினர் பட்டியல்',
    'Actions': 'செயல்கள்',
    'There are no pending or rejected applications to review.': 'பரிசீலிக்க நிலுவையிலுள்ள அல்லது நிராகரிக்கப்பட்ட விண்ணப்பங்கள் இல்லை.',
    'No approved members yet. Approve an application above to issue a member card.': 'அங்கீகரிக்கப்பட்ட உறுப்பினர்கள் இன்னும் இல்லை. உறுப்பினர் அட்டையை வழங்க மேலுள்ள விண்ணப்பத்தை அங்கீகரிக்கவும்.',
    'Review applications and manage member cards, addresses, and membership status.': 'விண்ணப்பங்களைப் பரிசீலித்து உறுப்பினர் அட்டைகள், முகவரிகள் மற்றும் உறுப்பினர் நிலையை நிர்வகிக்கவும்.',
    'Choose language / மொழியைத் தேர்ந்தெடுக்கவும்': 'மொழியைத் தேர்ந்தெடுக்கவும்',
    'Applicant': 'விண்ணப்பதாரர்',
    'Submitted': 'சமர்ப்பிக்கப்பட்டது',
    'Status': 'நிலை',
    'Pending': 'நிலுவையில்',
    'pending': 'நிலுவையில்',
    'Approved': 'அங்கீகரிக்கப்பட்டது',
    'approved': 'அங்கீகரிக்கப்பட்டது',
    'Rejected': 'நிராகரிக்கப்பட்டது',
    'rejected': 'நிராகரிக்கப்பட்டது',
    'Your application is awaiting review.': 'உங்கள் விண்ணப்பம் பரிசீலனையில் உள்ளது.',
    'Your application has been approved.': 'உங்கள் விண்ணப்பம் அங்கீகரிக்கப்பட்டது.',
    'Your application was not approved.': 'உங்கள் விண்ணப்பம் அங்கீகரிக்கப்படவில்லை.',
    'Back to home': 'முகப்புக்குத் திரும்பு',
    'Check another application': 'வேறொரு விண்ணப்பத்தைப் பார்க்கவும்',
    'Apply for PTK membership': 'PTK உறுப்பினர் சேர்க்கைக்கு விண்ணப்பிக்கவும்',
    'Tamil name (optional)': 'தமிழ்ப் பெயர் (விருப்பத்தேர்வு)',
    'Contact number': 'தொடர்பு எண்',
    'Local unit': 'உள்ளூர் பிரிவு',
    'Address': 'முகவரி',
    'Profile photo (optional, JPG/PNG/WEBP, max 5 MB)': 'சுயவிவரப் படம் (விருப்பத்தேர்வு, JPG/PNG/WEBP, அதிகபட்சம் 5 MB)',
    'Membership category': 'உறுப்பினர் வகை',
    'Select': 'தேர்ந்தெடுக்கவும்',
    'General Member': 'பொது உறுப்பினர்',
    'Youth Member': 'இளைஞர் உறுப்பினர்',
    'Women Member': 'மகளிர் உறுப்பினர்',
    'Student Member': 'மாணவர் உறுப்பினர்',
    'I agree to the privacy notice and consent to PTK processing my information for membership review.': 'தனியுரிமை அறிவிப்பை ஏற்று, உறுப்பினர் பரிசீலனைக்காக எனது தகவல்களை PTK செயலாக்க ஒப்புக்கொள்கிறேன்.',
    'Submit application': 'விண்ணப்பத்தைச் சமர்ப்பிக்கவும்',
    'Administrator access': 'நிர்வாகி உள்நுழைவு',
    'Username': 'பயனர்பெயர்',
    'Password': 'கடவுச்சொல்',
    'Login': 'உள்நுழைக',
    'Public site': 'பொது இணையதளம்',
    'Logout': 'வெளியேறு',
    'Dashboard': 'நிர்வாகப் பலகை',
    'Overview': 'கண்ணோட்டம்',
    'Members': 'உறுப்பினர்கள்',
    'Branding': 'அடையாள அமைப்புகள்',
    'Website content': 'இணையதள உள்ளடக்கம்',
    'Events': 'நிகழ்வுகள்',
    'Grievances': 'குறைகள்',
    'Contacts': 'தொடர்புகள்',
    'Reports': 'அறிக்கைகள்',
    'Backup': 'காப்புப்பிரதி',
    'PTK administration overview': 'PTK நிர்வாகக் கண்ணோட்டம்',
    'Applications': 'விண்ணப்பங்கள்',
    'Active cards': 'செயல்பாட்டிலுள்ள அட்டைகள்',
    'Contact requests': 'தொடர்பு கோரிக்கைகள்',
    'Recent applications': 'சமீபத்திய விண்ணப்பங்கள்',
    'Reference': 'குறிப்பு எண்',
    'Action': 'செயல்',
    'Review note': 'பரிசீலனைக் குறிப்பு',
    'Reopen and approve': 'மீண்டும் திறந்து அங்கீகரிக்கவும்',
    'Approve': 'அங்கீகரிக்கவும்',
    'Reject': 'நிராகரிக்கவும்',
    'Manage member': 'உறுப்பினரை நிர்வகிக்கவும்',
    'Recent members': 'சமீபத்திய உறுப்பினர்கள்',
    'Member ID': 'உறுப்பினர் அடையாள எண்',
    'Card': 'அட்டை',
    'View card': 'அட்டையைப் பார்க்கவும்',
    'Audit log': 'செயல் பதிவு',
    'Details': 'விவரங்கள்',
    'Created': 'உருவாக்கப்பட்டது',
    'Create and publish updates': 'செய்திகளை உருவாக்கி வெளியிடவும்',
    'Title': 'தலைப்பு',
    'Content': 'உள்ளடக்கம்',
    'Publish immediately': 'உடனடியாக வெளியிடவும்',
    'Save announcement': 'அறிவிப்பைச் சேமிக்கவும்',
    'Existing announcements': 'ஏற்கனவே உள்ள அறிவிப்புகள்',
    'Published': 'வெளியிடப்பட்டது',
    'Yes': 'ஆம்',
    'No': 'இல்லை',
    'Party identity and colour settings': 'கட்சியின் அடையாளம் மற்றும் வண்ண அமைப்புகள்',
    'Tamil party name': 'கட்சியின் தமிழ்ப் பெயர்',
    'English party name': 'கட்சியின் ஆங்கிலப் பெயர்',
    'Tagline': 'கொள்கை வாசகம்',
    'Leader name': 'தலைவர் பெயர்',
    'Leader title': 'தலைவர் பதவி',
    'Contact email': 'தொடர்பு மின்னஞ்சல்',
    'Contact phone': 'தொடர்பு தொலைபேசி',
    'Contact address': 'தொடர்பு முகவரி',
    'Brand images': 'கட்சியின் அடையாளப் படங்கள்',
    'Upload JPG, PNG, or WEBP files up to 5 MB. Leave a file blank to keep the current image.': 'அதிகபட்சம் 5 MB அளவுள்ள JPG, PNG அல்லது WEBP படங்களைப் பதிவேற்றவும். தற்போதைய படத்தை வைத்திருக்க கோப்பைத் தேர்ந்தெடுக்காமல் விடவும்.',
    'Party logo': 'கட்சிச் சின்னம்',
    'Current party logo': 'தற்போதைய கட்சிச் சின்னம்',
    'Leader photo': 'தலைவர் படம்',
    'Current leader photo': 'தற்போதைய தலைவர் படம்',
    'Party flag': 'கட்சிக் கொடி',
    'Current party flag': 'தற்போதைய கட்சிக் கொடி',
    'Leader signature': 'தலைவர் கையொப்பம்',
    'Current leader signature': 'தற்போதைய தலைவர் கையொப்பம்',
    'Homepage background': 'முகப்புப் பக்கப் பின்னணி',
    'Current homepage background': 'தற்போதைய முகப்புப் பக்கப் பின்னணி',
    'Membership card background': 'உறுப்பினர் அட்டை பின்னணி',
    'Current membership card background': 'தற்போதைய உறுப்பினர் அட்டை பின்னணி',
    'Membership card palette': 'உறுப்பினர் அட்டை வண்ணங்கள்',
    'Card red': 'அட்டை சிவப்பு',
    'Card yellow': 'அட்டை மஞ்சள்',
    'Card green': 'அட்டை பச்சை',
    'About text': 'எங்களைப் பற்றிய உரை',
    'Mission text': 'பணி உரை',
    'Vision text': 'தொலைநோக்கு உரை',
    'Save branding': 'அடையாள அமைப்புகளைச் சேமிக்கவும்',
    'Manage content published on the public site': 'பொது இணையதளத்தில் வெளியிடப்படும் உள்ளடக்கத்தை நிர்வகிக்கவும்',
    'Privacy policy': 'தனியுரிமைக் கொள்கை',
    'Terms and conditions': 'விதிமுறைகள் மற்றும் நிபந்தனைகள்',
    'Save content': 'உள்ளடக்கத்தைச் சேமிக்கவும்',
    'Create and publish public events': 'பொது நிகழ்வுகளை உருவாக்கி வெளியிடவும்',
    'Save event': 'நிகழ்வைச் சேமிக்கவும்',
    'Existing events': 'ஏற்கனவே உள்ள நிகழ்வுகள்',
    'Volunteer registration submissions': 'தன்னார்வலர் பதிவுகள்',
    'Interest': 'ஆர்வம்',
    'Public grievance submissions': 'பொதுமக்கள் குறைகள்',
    'Contact Requests': 'தொடர்பு கோரிக்கைகள்',
    'Public contact form submissions': 'பொது தொடர்புப் படிவக் கோரிக்கைகள்',
    'Email': 'மின்னஞ்சல்',
    'Subject': 'பொருள்',
    'Generate CSV exports and data reports': 'CSV ஏற்றுமதிகளையும் தரவு அறிக்கைகளையும் உருவாக்கவும்',
    'Available exports': 'கிடைக்கும் ஏற்றுமதிகள்',
    'Export members (CSV)': 'உறுப்பினர்களை ஏற்றுமதி செய் (CSV)',
    'Export applications (CSV)': 'விண்ணப்பங்களை ஏற்றுமதி செய் (CSV)',
    'Export volunteers (CSV)': 'தன்னார்வலர்களை ஏற்றுமதி செய் (CSV)',
    'Member count by district': 'மாவட்ட வாரியான உறுப்பினர் எண்ணிக்கை',
    'Backup & Restore': 'காப்புப்பிரதி மற்றும் மீட்டமைப்பு',
    'Database backup and recovery': 'தரவுத்தளக் காப்புப்பிரதி மற்றும் மீட்டமைப்பு',
    'Export database backup': 'தரவுத்தளக் காப்புப்பிரதியை ஏற்றுமதி செய்',
    'Download a complete JSON backup of all platform data. This file can be used to restore data later.': 'தளத்தின் அனைத்து தரவுகளுக்குமான முழுமையான JSON காப்புப்பிரதியைப் பதிவிறக்கவும். இதைப் பயன்படுத்தி பின்னர் தரவை மீட்டமைக்கலாம்.',
    'Download backup': 'காப்புப்பிரதியைப் பதிவிறக்கவும்',
    'Restore from backup': 'காப்புப்பிரதியிலிருந்து மீட்டமைக்கவும்',
    'Upload a previously exported backup file. This will replace existing records with data from the backup.': 'முன்பு ஏற்றுமதி செய்த காப்புப்பிரதியைப் பதிவேற்றவும். இது தற்போதைய பதிவுகளை காப்புப்பிரதித் தரவுகளால் மாற்றும்.',
    'Paste JSON backup content': 'JSON காப்புப்பிரதி உள்ளடக்கத்தை ஒட்டவும்',
    'Backup information': 'காப்புப்பிரதி தகவல்',
    'System settings': 'கணினி அமைப்புகள்',
    'Security, backups, and application controls': 'பாதுகாப்பு, காப்புப்பிரதி மற்றும் பயன்பாட்டுக் கட்டுப்பாடுகள்',
    'Administrator PIN': 'நிர்வாக PIN',
    'This PIN protects admin pages in this browser only. It is not server-side authentication and does not replace your administrator username and password.': 'இந்த PIN இந்த உலாவியில் மட்டும் நிர்வாகப் பக்கங்களைப் பாதுகாக்கும். இது சேவையக அங்கீகாரம் அல்ல; உங்கள் நிர்வாகப் பயனர்பெயர் மற்றும் கடவுச்சொல்லுக்கு மாற்றாகாது.',
    'Current PIN': 'தற்போதைய PIN',
    'New PIN': 'புதிய PIN',
    'Confirm new PIN': 'புதிய PIN-ஐ உறுதிப்படுத்தவும்',
    'Change PIN': 'PIN-ஐ மாற்றவும்',
    'If you forget this browser-only PIN, clear this site\'s browser storage to reset it. You will still need your administrator login.': 'இந்த உலாவி PIN-ஐ மறந்துவிட்டால், மீட்டமைக்க இந்த தளத்தின் உலாவிச் சேமிப்பகத்தை அழிக்கவும். நிர்வாகி உள்நுழைவு இன்னும் தேவை.',
    'Set a 4–12 digit PIN.': '4–12 இலக்க PIN அமைக்கவும்.',
    'Enter your current PIN to continue.': 'தொடர தற்போதைய PIN-ஐ உள்ளிடவும்.',
    'PINs do not match.': 'PIN-கள் பொருந்தவில்லை.',
    'PIN changed for this browser.': 'இந்த உலாவிக்கான PIN மாற்றப்பட்டது.',
    'The current PIN is incorrect.': 'தற்போதைய PIN தவறானது.',
    'Local browser storage is unavailable. Enable it and reload this page.': 'உள்ளூர் உலாவிச் சேமிப்பகம் கிடைக்கவில்லை. அதை இயக்கி இந்தப் பக்கத்தை மீண்டும் ஏற்றவும்.',
    'Admin PIN required': 'நிர்வாக PIN தேவை',
    'Enter the PIN configured for this browser to continue.': 'தொடர இந்த உலாவிக்காக அமைக்கப்பட்ட PIN-ஐ உள்ளிடவும்.',
    'Unlock admin pages': 'நிர்வாகப் பக்கங்களைத் திறக்கவும்',
    'Incorrect PIN. Try again.': 'PIN தவறானது. மீண்டும் முயற்சிக்கவும்.',
    'PIN data is invalid. Clear this site’s browser storage to reset it, then sign in again.': 'PIN தரவு தவறானது. மீட்டமைக்க இந்த தளத்தின் உலாவிச் சேமிப்பகத்தை அழித்து மீண்டும் உள்நுழையவும்.',
    'This local PIN is only a browser lock, not server-side authentication.': 'இந்த உள்ளூர் PIN உலாவிப் பூட்டு மட்டுமே; சேவையக அங்கீகாரம் அல்ல.',
    "If you forget the PIN, clear this site's browser storage. Server-side administrator login is still required.": 'PIN-ஐ மறந்துவிட்டால், இந்தத் தளத்தின் உலாவிச் சேமிப்பகத்தை அழிக்கவும். சேவையக நிர்வாகி உள்நுழைவு இன்னும் தேவை.',
    'Applications to review': 'பரிசீலிக்க வேண்டிய விண்ணப்பங்கள்',
    'Active members': 'செயல்பாட்டிலுள்ள உறுப்பினர்கள்',
    'Show all members': 'அனைத்து உறுப்பினர்களையும் காட்டு',
    'Backups include all settings, members, applications, announcements, events, and audit logs': 'காப்புப்பிரதியில் அமைப்புகள், உறுப்பினர்கள், விண்ணப்பங்கள், அறிவிப்புகள், நிகழ்வுகள் மற்றும் செயல்பதிவுகள் அடங்கும்',
    'Admin user accounts are NOT included in backups for security': 'பாதுகாப்பு காரணமாக நிர்வாகி கணக்குகள் காப்புப்பிரதியில் சேர்க்கப்படாது',
    'Restore will clear existing data for each table and load from backup': 'மீட்டமைக்கும்போது ஒவ்வொரு அட்டவணையிலும் உள்ள தரவு நீக்கப்பட்டு காப்புப்பிரதித் தரவு ஏற்றப்படும்',
    'Keep backups in a secure location': 'காப்புப்பிரதிகளைப் பாதுகாப்பான இடத்தில் வைக்கவும்',
    'Test restore on a copy of your data first': 'முதலில் தரவின் நகலில் மீட்டமைப்பைச் சோதிக்கவும்',
    'Page not found': 'பக்கம் கிடைக்கவில்லை',
    'The page you requested is unavailable. Please return to the homepage.': 'நீங்கள் கேட்ட பக்கம் கிடைக்கவில்லை. முகப்புப் பக்கத்திற்குத் திரும்பவும்.',
    'Verification failed': 'சரிபார்ப்பு தோல்வியடைந்தது',
    'This membership card is not valid or has been revoked.': 'இந்த உறுப்பினர் அட்டை செல்லுபடியாகாதது அல்லது ரத்து செய்யப்பட்டுள்ளது.',
    'Membership verified': 'உறுப்பினர் சரிபார்க்கப்பட்டார்',
    'is an active PTK member.': 'PTK-இன் செயல்பாட்டிலுள்ள உறுப்பினர்.',
    'Membership category:': 'உறுப்பினர் வகை:',
    'Membership Card': 'உறுப்பினர் அட்டை',
    'Tamil name not provided': 'தமிழ்ப் பெயர் வழங்கப்படவில்லை',
    'Tamil name': 'தமிழ்ப் பெயர்',
    'Unit': 'பிரிவு',
    'Issue date': 'வழங்கிய தேதி',
    'Active': 'செயல்பாட்டில்',
    'active': 'செயல்பாட்டில்',
    'Inactive': 'செயலிழந்தது',
    'inactive': 'செயலிழந்தது',
    'new': 'புதியது',
    'reviewed': 'பரிசீலிக்கப்பட்டது',
    'Authorized by PTK': 'PTK-ஆல் அங்கீகரிக்கப்பட்டது',
    'Back to members': 'உறுப்பினர் பட்டியலுக்குத் திரும்பு',
    'Print card': 'அட்டையை அச்சிடு',
    'PTK logo': 'PTK சின்னம்',
    'PTK flag': 'PTK கொடி',
    'PTK leader': 'PTK தலைவர்',
    'Member photo': 'உறுப்பினர் படம்',
    'Member photo unavailable': 'உறுப்பினர் படம் கிடைக்கவில்லை',
    'Member photo (JPG/PNG/WEBP, max 5 MB)': 'உறுப்பினர் படம் (JPG/PNG/WEBP, அதிகபட்சம் 5 MB)',
    'QR code': 'QR குறியீடு',
    'N/A': 'கிடைக்கவில்லை',
    'Pending / நிலுவை': 'நிலுவையில்',
    'Active / செயல்பாட்டில்': 'செயல்பாட்டில்',
    'Inactive / செயலிழந்தது': 'செயலிழந்தது',
    'Issued': 'வழங்கப்பட்டது',
    'Save changes': 'மாற்றங்களைச் சேமிக்கவும்',
    'Edit': 'திருத்து',
    'Delete': 'நீக்கு',
    'Deactivate': 'செயலிழக்கச் செய்',
    'Reactivate': 'மீண்டும் செயல்படுத்து',
    'Search members / உறுப்பினர்களைத் தேடவும்': 'உறுப்பினர்களைத் தேடவும்',
    'Name, member ID, phone, or full address / பெயர், அடையாள எண், தொலைபேசி அல்லது முழு முகவரி': 'பெயர், அடையாள எண், தொலைபேசி அல்லது முழு முகவரி',
    'Export members CSV': 'உறுப்பினர் CSV-ஐ ஏற்றுமதி செய்',
    'Member management': 'உறுப்பினர் நிர்வாகம்',
    'Application status lookup': 'விண்ணப்ப நிலை தேடல்',
    'Please complete all required fields and accept the privacy notice.': 'தேவையான அனைத்து விவரங்களையும் நிரப்பி தனியுரிமை அறிவிப்பை ஏற்கவும்.',
    'A pending or approved application already exists for this contact information.': 'இந்தத் தொடர்பு விவரங்களுக்கு நிலுவையிலுள்ள அல்லது அங்கீகரிக்கப்பட்ட விண்ணப்பம் ஏற்கனவே உள்ளது.',
    'Your application has been submitted successfully. Reference:': 'உங்கள் விண்ணப்பம் வெற்றிகரமாகச் சமர்ப்பிக்கப்பட்டது. குறிப்பு எண்:',
    'Please fill in the required volunteer fields.': 'தேவையான தன்னார்வலர் விவரங்களை நிரப்பவும்.',
    'Please complete all grievance fields.': 'குறைப் படிவத்தில் உள்ள அனைத்து விவரங்களையும் நிரப்பவும்.',
    'Please complete the contact form.': 'தொடர்புப் படிவத்தை முழுமையாக நிரப்பவும்.',
    'Your request could not be submitted. Please try again.': 'உங்கள் கோரிக்கையைச் சமர்ப்பிக்க முடியவில்லை. மீண்டும் முயற்சிக்கவும்.',
    'Submitted successfully': 'வெற்றிகரமாகச் சமர்ப்பிக்கப்பட்டது',
    'Volunteer registration saved successfully. Your reference is': 'தன்னார்வலர் பதிவு வெற்றிகரமாகச் சேமிக்கப்பட்டது. உங்கள் குறிப்பு எண்:',
    'Your grievance has been submitted. Reference:': 'உங்கள் குறை சமர்ப்பிக்கப்பட்டது. குறிப்பு எண்:',
    'Thank you. Your message has been received. Reference:': 'நன்றி. உங்கள் செய்தி பெறப்பட்டது. குறிப்பு எண்:',
    'This will replace existing data. Continue?': 'தற்போதைய தரவு மாற்றப்படும். தொடரவா?',
    'Invalid username or password.': 'பயனர்பெயர் அல்லது கடவுச்சொல் தவறானது.',
    'Only JPG, PNG, and WEBP images are allowed.': 'JPG, PNG மற்றும் WEBP படங்கள் மட்டுமே அனுமதிக்கப்படும்.',
    'Name, phone, district, local unit, full address, and membership category are required.': 'பெயர், தொலைபேசி, மாவட்டம், உள்ளூர் பிரிவு, முழு முகவரி மற்றும் உறுப்பினர் வகை அவசியம்.',
    'Another member already uses this phone number.': 'இந்தத் தொலைபேசி எண்ணை மற்றொரு உறுப்பினர் ஏற்கனவே பயன்படுத்துகிறார்.',
    'Member not found.': 'உறுப்பினர் கிடைக்கவில்லை.',
    'Application not found': 'விண்ணப்பம் கிடைக்கவில்லை',
    'Choose approve or reject for a membership application.': 'உறுப்பினர் விண்ணப்பத்திற்கு அங்கீகரிக்கவும் அல்லது நிராகரிக்கவும் என்பதைத் தேர்ந்தெடுக்கவும்.',
    'This application is already approved. Deactivate the member instead.': 'இந்த விண்ணப்பம் ஏற்கனவே அங்கீகரிக்கப்பட்டுள்ளது. அதற்குப் பதிலாக உறுப்பினரைச் செயலிழக்கச் செய்யவும்.',
    'This application cannot be reviewed in its current state.': 'தற்போதைய நிலையில் இந்த விண்ணப்பத்தைப் பரிசீலிக்க முடியாது.',
    'This membership card is not valid or has been revoked.': 'இந்த உறுப்பினர் அட்டை செல்லுபடியாகாதது அல்லது ரத்து செய்யப்பட்டுள்ளது.',
    'An unexpected server error occurred.': 'எதிர்பாராத சேவையகப் பிழை ஏற்பட்டது.'
  };

  const textState = new WeakMap();
  const attributeState = new WeakMap();
  let currentLanguage = 'en';

  function translate(value) {
    const trimmed = value.trim();
    if (translations[trimmed]) return value.replace(trimmed, translations[trimmed]);
    const title = /^(.+?)\s+\|\s+(.+)$/.exec(trimmed);
    if (title && translations[title[1]]) {
      return value.replace(trimmed, `${translations[title[1]]} | ${title[2]}`);
    }
    const patterns = [
      [/^Your application has been submitted successfully\. Reference:\s*(.+)$/, 'உங்கள் விண்ணப்பம் வெற்றிகரமாகச் சமர்ப்பிக்கப்பட்டது. குறிப்பு எண்: $1'],
      [/^Volunteer registration saved successfully\. Your reference is\s*(.+)$/, 'தன்னார்வலர் பதிவு வெற்றிகரமாகச் சேமிக்கப்பட்டது. உங்கள் குறிப்பு எண்: $1'],
      [/^Your grievance has been submitted\. Reference:\s*(.+)$/, 'உங்கள் குறை சமர்ப்பிக்கப்பட்டது. குறிப்பு எண்: $1'],
      [/^Thank you\. Your message has been received\. Reference:\s*(.+)$/, 'நன்றி. உங்கள் செய்தி பெறப்பட்டது. குறிப்பு எண்: $1']
    ];
    for (const [pattern, replacement] of patterns) {
      if (pattern.test(trimmed)) return value.replace(trimmed, trimmed.replace(pattern, replacement));
    }
    return value;
  }

  function translateText(node) {
    if (!node.nodeValue || node.parentElement.closest('script, style, textarea, .lang-ta')) return;
    let state = textState.get(node);
    if (!state) {
      state = { original: node.nodeValue, rendered: node.nodeValue };
      textState.set(node, state);
    } else if (node.nodeValue !== state.rendered) {
      state.original = node.nodeValue;
    }
    const next = currentLanguage === 'ta' ? translate(state.original) : state.original;
    if (node.nodeValue !== next) {
      state.rendered = next;
      node.nodeValue = next;
    } else {
      state.rendered = next;
    }
  }

  function translateAttributes(element) {
    const attributes = ['placeholder', 'title', 'aria-label', 'alt'];
    if (element.tagName === 'META' && element.name === 'description') attributes.push('content');
    let state = attributeState.get(element);
    if (!state) {
      state = {};
      attributeState.set(element, state);
    }
    for (const name of attributes) {
      if (!element.hasAttribute(name)) continue;
      if (!Object.prototype.hasOwnProperty.call(state, name)) state[name] = element.getAttribute(name);
      const value = state[name];
      element.setAttribute(name, currentLanguage === 'ta' ? translate(value) : value);
    }
  }

  function updatePage() {
    document.documentElement.lang = currentLanguage;
    document.body.dataset.language = currentLanguage;
    const walker = document.createTreeWalker(document.documentElement, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) translateText(walker.currentNode);
    document.querySelectorAll('[placeholder], [title], [aria-label], [alt], meta[name="description"]').forEach(translateAttributes);
    document.querySelectorAll('[data-language-choice]').forEach(button => {
      button.setAttribute('aria-pressed', String(button.dataset.languageChoice === currentLanguage));
    });
  }

  function setLanguage(language) {
    currentLanguage = language === 'ta' ? 'ta' : 'en';
    updatePage();
    try {
      localStorage.setItem('ptk-admin-language', currentLanguage);
    } catch (error) {
      // The selected language remains active for this page if storage is unavailable.
    }
  }

  function createPicker() {
    let picker = document.querySelector('.language-picker');
    if (!picker) {
      picker = document.createElement('div');
      picker.className = 'language-picker ptk-language-picker';
      const topbar = document.querySelector('.site-header .topbar');
      if (topbar) topbar.appendChild(picker);
      else document.body.prepend(picker);
      picker.innerHTML = '<button type="button" data-language-choice="en" lang="en">English</button><button type="button" data-language-choice="ta" lang="ta">தமிழ்</button>';
    }
    picker.querySelectorAll('[data-language-choice]').forEach(button => {
      button.addEventListener('click', () => setLanguage(button.dataset.languageChoice));
    });
  }

  const adminPinKey = 'ptk-admin-local-pin-v1';
  const adminPinSessionKey = 'ptk-admin-local-pin-unlocked';
  const pinIterations = 150000;

  function bytesToHex(bytes) {
    return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  function hexToBytes(hex) {
    if (typeof hex !== 'string' || !/^(?:[0-9a-f]{2})+$/i.test(hex)) throw new Error('invalid');
    return new Uint8Array(hex.match(/.{2}/g).map(byte => parseInt(byte, 16)));
  }

  async function derivePinHash(pin, salt) {
    if (!window.crypto || !window.crypto.subtle) throw new Error('storage-unavailable');
    const key = await window.crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits']);
    const bits = await window.crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt, iterations: pinIterations, hash: 'SHA-256' },
      key,
      256
    );
    return bytesToHex(new Uint8Array(bits));
  }

  function readPinRecord() {
    let value;
    try {
      value = localStorage.getItem(adminPinKey);
    } catch (error) {
      throw new Error('storage-unavailable');
    }
    if (value === null) return null;
    let record;
    try {
      record = JSON.parse(value);
    } catch (error) {
      throw new Error('invalid-pin-record');
    }
    if (!record || record.version !== 1 || record.iterations !== pinIterations ||
        typeof record.salt !== 'string' || typeof record.hash !== 'string' ||
        !/^[0-9a-f]{32}$/i.test(record.salt) || !/^[0-9a-f]{64}$/i.test(record.hash)) {
      throw new Error('invalid-pin-record');
    }
    return record;
  }

  function createPinLock(record, storageError) {
    if (!window.location.pathname.startsWith('/admin/') ||
        ['/admin/login', '/admin/logout'].includes(window.location.pathname)) return;
    if (!storageError && (!record || sessionStorage.getItem(adminPinSessionKey) === record.hash)) return;

    const overlay = document.createElement('div');
    overlay.className = 'ptk-admin-pin-lock';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'ptk-admin-pin-title');
    overlay.style.cssText = 'position:fixed;inset:0;z-index:10000;display:grid;place-items:center;padding:20px;background:#f5f7f6;';
    overlay.innerHTML = `
      <section style="box-sizing:border-box;width:min(100%,480px);padding:32px;border-radius:20px;background:#fff;box-shadow:0 18px 34px rgba(17,24,39,.12);">
        <div style="display:flex;justify-content:flex-end;gap:8px;margin-bottom:20px;">
          <button type="button" data-lock-language="en">English</button>
          <button type="button" data-lock-language="ta" lang="ta">தமிழ்</button>
        </div>
        <h1 id="ptk-admin-pin-title">Admin PIN required</h1>
        <p>This PIN protects admin pages in this browser only. It is not server-side authentication and does not replace your administrator username and password.</p>
        <form id="ptk-admin-pin-unlock">
          <label for="ptk-admin-pin-entry">Administrator PIN</label>
          <input id="ptk-admin-pin-entry" name="pin" type="password" inputmode="numeric" pattern="[0-9]{4,12}" minlength="4" maxlength="12" autocomplete="current-password" required style="display:block;width:100%;margin:10px 0 16px;box-sizing:border-box;" />
          <button type="submit">Unlock admin pages</button>
        </form>
        <p id="ptk-admin-pin-error" role="status" aria-live="polite"></p>
        <p>If you forget the PIN, clear this site's browser storage. Server-side administrator login is still required.</p>
      </section>`;
    const coveredElements = Array.from(document.body.children).filter(element => element !== overlay);
    coveredElements.forEach(element => {
      element.inert = true;
      element.setAttribute('aria-hidden', 'true');
    });
    document.body.appendChild(overlay);
    overlay.querySelectorAll('[data-lock-language]').forEach(button => {
      button.addEventListener('click', () => setLanguage(button.dataset.lockLanguage));
    });

    const error = overlay.querySelector('#ptk-admin-pin-error');
    if (storageError) {
      error.textContent = storageError;
      overlay.querySelector('input').disabled = true;
      overlay.querySelector('button[type="submit"]').disabled = true;
      return;
    }

    overlay.querySelector('#ptk-admin-pin-unlock').addEventListener('submit', async event => {
      event.preventDefault();
      const input = overlay.querySelector('#ptk-admin-pin-entry');
      try {
        const actual = await derivePinHash(input.value, hexToBytes(record.salt));
        if (actual !== record.hash) {
          error.textContent = 'Incorrect PIN. Try again.';
          input.select();
          return;
        }
        sessionStorage.setItem(adminPinSessionKey, record.hash);
        coveredElements.forEach(element => {
          element.inert = false;
          element.removeAttribute('aria-hidden');
        });
        overlay.remove();
      } catch (failure) {
        error.textContent = failure.message === 'storage-unavailable'
          ? 'Local browser storage is unavailable. Enable it and reload this page.'
          : 'PIN data is invalid. Clear this site’s browser storage to reset it, then sign in again.';
      }
    });
  }

  function initializeAdminPin() {
    const isAdminPage = window.location.pathname.startsWith('/admin/') &&
      !['/admin/login', '/admin/logout'].includes(window.location.pathname);
    if (!isAdminPage) return;

    let record = null;
    let storageError = null;
    try {
      record = readPinRecord();
    } catch (error) {
      storageError = error.message === 'invalid-pin-record'
        ? 'PIN data is invalid. Clear this site’s browser storage to reset it, then sign in again.'
        : 'Local browser storage is unavailable. Enable it and reload this page.';
    }

    createPinLock(record, storageError);
    const form = document.querySelector('#admin-pin-form');
    if (!form) return;
    const currentField = document.querySelector('#admin-pin-current-field');
    const currentInput = form.elements.current_pin;
    const message = document.querySelector('#admin-pin-message');
    if (record) {
      currentField.hidden = false;
      currentInput.required = true;
    }

    form.addEventListener('submit', async event => {
      event.preventDefault();
      const currentPin = currentInput.value;
      const newPin = form.elements.new_pin.value;
      const confirmation = form.elements.confirm_pin.value;
      message.textContent = '';
      if (!/^\d{4,12}$/.test(newPin)) {
        message.textContent = 'Set a 4–12 digit PIN.';
        return;
      }
      if (newPin !== confirmation) {
        message.textContent = 'PINs do not match.';
        return;
      }

      try {
        if (record) {
          const currentHash = await derivePinHash(currentPin, hexToBytes(record.salt));
          if (currentHash !== record.hash) {
            message.textContent = 'The current PIN is incorrect.';
            return;
          }
        }
        const salt = window.crypto.getRandomValues(new Uint8Array(16));
        const nextRecord = {
          version: 1,
          iterations: pinIterations,
          salt: bytesToHex(salt),
          hash: await derivePinHash(newPin, salt)
        };
        localStorage.setItem(adminPinKey, JSON.stringify(nextRecord));
        sessionStorage.setItem(adminPinSessionKey, nextRecord.hash);
        record = nextRecord;
        currentField.hidden = false;
        currentInput.required = true;
        message.textContent = 'PIN changed for this browser.';
        form.reset();
        if (document.querySelector('.ptk-admin-pin-lock')) {
          document.querySelector('.ptk-admin-pin-lock').remove();
        }
      } catch (error) {
        message.textContent = error.message === 'storage-unavailable'
          ? 'Local browser storage is unavailable. Enable it and reload this page.'
          : 'PIN data is invalid. Clear this site’s browser storage to reset it, then sign in again.';
      }
    });
  }

  function initialize() {
    createPicker();
    try {
      const saved = localStorage.getItem('ptk-admin-language');
      if (saved === 'ta') currentLanguage = 'ta';
    } catch (error) {
      currentLanguage = 'en';
    }
    initializeAdminPin();
    updatePage();
    const observer = new MutationObserver(records => {
      for (const record of records) {
        if (record.type === 'characterData') translateText(record.target);
        record.addedNodes && record.addedNodes.forEach(node => {
          if (node.nodeType === Node.TEXT_NODE) translateText(node);
          else if (node.nodeType === Node.ELEMENT_NODE) {
            const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
            while (walker.nextNode()) translateText(walker.currentNode);
            translateAttributes(node);
            node.querySelectorAll('[placeholder], [title], [aria-label], [alt], meta[name="description"]').forEach(translateAttributes);
          }
        });
      }
    });
    observer.observe(document.body, { childList: true, characterData: true, subtree: true });
  }

  window.ptkTranslate = translate;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true });
  else initialize();
})();
