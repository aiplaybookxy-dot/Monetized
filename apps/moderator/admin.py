# Moderator app does not register models directly in admin.
# Order and AccountListing are registered in their own apps:
#   - apps/orders/admin.py
#   - apps/listings/admin.py
# Moderator logic is handled via the moderator views and API.