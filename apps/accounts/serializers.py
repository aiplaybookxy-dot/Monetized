from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from .models import LoginActivity

User = get_user_model()


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, validators=[validate_password])
    password2 = serializers.CharField(write_only=True, label="Confirm Password")

    class Meta:
        model = User
        fields = ["email", "username", "full_name", "password", "password2"]

    def validate(self, attrs):
        if attrs["password"] != attrs.pop("password2"):
            raise serializers.ValidationError({"password": "Passwords do not match."})
        return attrs

    def create(self, validated_data):
        return User.objects.create_user(**validated_data)


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    """Extend the JWT payload with user info so the frontend never needs a second call."""

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token["username"] = user.username
        token["email"] = user.email
        return token

    def validate(self, attrs):
        data = super().validate(attrs)
        data["user"] = UserPublicSerializer(self.user).data
        return data


class UserPublicSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = [
            "id", "email", "username", "full_name", "avatar", "bio",
            "role",                    # ← ADD THIS — frontend routing depends on it
            "is_active",               # ← ADD THIS
            "seller_rating", 
            "completed_sales", 
            "completed_purchases",
            "total_earned", 
            "total_spent", 
            "is_email_verified", 
            "date_joined",
        ]
        read_only_fields = [
            "id", "role", "seller_rating", "completed_sales", "completed_purchases",
            "total_earned", "total_spent", "is_email_verified", "date_joined",
        ]


class UserUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["full_name", "username", "bio", "avatar"]

    def validate_username(self, value):
        qs = User.objects.filter(username__iexact=value).exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError("This username is already taken.")
        return value


class ChangePasswordSerializer(serializers.Serializer):
    old_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True, validators=[validate_password])
    new_password2 = serializers.CharField(write_only=True)

    def validate(self, attrs):
        if attrs["new_password"] != attrs["new_password2"]:
            raise serializers.ValidationError({"new_password": "Passwords do not match."})
        return attrs

    def validate_old_password(self, value):
        user = self.context["request"].user
        if not user.check_password(value):
            raise serializers.ValidationError("Current password is incorrect.")
        return value

    def save(self, **kwargs):
        user = self.context["request"].user
        user.set_password(self.validated_data["new_password"])
        user.save(update_fields=["password"])
        return user


class LoginActivitySerializer(serializers.ModelSerializer):
    class Meta:
        model = LoginActivity
        fields = ["id", "ip_address", "user_agent", "was_successful", "timestamp"]